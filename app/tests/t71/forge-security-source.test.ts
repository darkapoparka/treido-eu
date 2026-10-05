import {
  createHash,
  generateKeyPairSync,
  verify as nativeVerify,
} from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { memoryRequire, sourcePackage } from "./security-source-loader";

type Digest = {
  update(message: string): void;
  digest(): { getBytes(): string };
};
type Scheme = object;
type PrivateKey = {
  sign(digest: Digest | string, scheme?: Scheme | string): string;
};
type PublicKey = {
  verify(digest: string, signature: string, scheme?: Scheme): boolean;
};
type Asn1 = { value: string | Asn1[] };
type Forge = {
  oids: Record<string, string>;
  asn1: {
    Class: { UNIVERSAL: number };
    Type: Record<string, number>;
    create(
      tag: number,
      type: number,
      constructed: boolean,
      value: string | Asn1[],
    ): Asn1;
    toDer(value: Asn1): { getBytes(): string };
    oidToDer(value: string): { getBytes(): string };
  };
  md: Record<string, { create(): Digest }>;
  pki: {
    privateKeyFromPem(pem: string): PrivateKey;
    publicKeyFromPem(pem: string): PublicKey;
  };
  pss: { create(options: object): Scheme };
  mgf: { mgf1: { create(md: Digest): object } };
};

// Disposable synthetic test key/message, never written or used by the product.
const message = "Treido synthetic dependency-security regression only";
const keys = generateKeyPairSync("rsa", {
  modulusLength: 1024,
  publicExponent: 3,
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
function fixture(patched: boolean) {
  const source = sourcePackage("node-forge", "1.4.0", patched);
  const forge = memoryRequire([source])(
    resolve(source.root, "lib/index.js"),
  ) as Forge;
  return {
    forge,
    privateKey: forge.pki.privateKeyFromPem(keys.privateKey),
    publicKey: forge.pki.publicKeyFromPem(keys.publicKey),
  };
}
const original = fixture(false);
const patched = fixture(true);
const sha256 = createHash("sha256").update(message).digest("latin1");

function digestInfo(
  forge: Forge,
  algorithm = "sha256",
  parameters:
    "absent" | "null" | "extra" | "wrong" | "nonempty" | "constructed" = "null",
  outerExtra = false,
) {
  const a = forge.asn1;
  const node = (type: string, value: string | Asn1[], constructed = false) =>
    a.create(a.Class.UNIVERSAL, a.Type[type], constructed, value);
  const children = [node("OID", a.oidToDer(forge.oids[algorithm]).getBytes())];
  if (parameters !== "absent") {
    children.push(
      parameters === "wrong"
        ? node("INTEGER", "\x00")
        : node(
            "NULL",
            parameters === "constructed"
              ? []
              : parameters === "nonempty"
                ? "x"
                : "",
            parameters === "constructed",
          ),
    );
  }
  if (parameters === "extra")
    children.push(node("OCTETSTRING", "synthetic garbage"));
  const digest =
    algorithm === "md2"
      ? "s".repeat(16)
      : createHash(algorithm).update(message).digest("latin1");
  const outer = [node("SEQUENCE", children, true), node("OCTETSTRING", digest)];
  if (outerExtra) outer.push(node("OCTETSTRING", "synthetic trailing element"));
  return { der: a.toDer(node("SEQUENCE", outer, true)).getBytes(), digest };
}

describe("T02b node-forge source mitigation", () => {
  it("proves nested garbage passes original genuine RSA verification and fails patched verification", () => {
    const { der } = digestInfo(original.forge, "sha256", "extra");
    // NONE creates valid PKCS#1 padding around our intentionally malformed ASN.1.
    // Verification uses the public default scheme, without bypass/test flags.
    const signature = original.privateKey.sign(der, "NONE");
    expect(original.publicKey.verify(sha256, signature)).toBe(true);
    expect(() => patched.publicKey.verify(sha256, signature)).toThrow(
      /DigestInfo/,
    );
  });

  it.each(["wrong", "nonempty", "constructed"] as const)(
    "rejects %s optional parameters on a genuine RSA verification path",
    (parameters) => {
      const { der } = digestInfo(original.forge, "sha256", parameters);
      const signature = original.privateKey.sign(der, "NONE");
      expect(original.publicKey.verify(sha256, signature)).toBe(true);
      expect(() => patched.publicKey.verify(sha256, signature)).toThrow();
    },
  );

  it.each([
    "sha1",
    "sha224",
    "sha256",
    "sha384",
    "sha512",
    "sha512-224",
    "sha512-256",
  ])("retains %s encodings with absent and NULL parameters", (algorithm) => {
    for (const parameters of ["absent", "null"] as const) {
      const { der, digest } = digestInfo(original.forge, algorithm, parameters);
      const signature = original.privateKey.sign(der, "NONE");
      expect(original.publicKey.verify(digest, signature)).toBe(true);
      expect(patched.publicKey.verify(digest, signature)).toBe(true);
    }
  });

  it.each(["md2", "md5"])(
    "preserves %s's existing mandatory NULL rule",
    (algorithm) => {
      for (const parameters of ["absent", "null"] as const) {
        const { der, digest } = digestInfo(
          original.forge,
          algorithm,
          parameters,
        );
        const signature = original.privateKey.sign(der, "NONE");
        if (parameters === "null")
          expect(patched.publicKey.verify(digest, signature)).toBe(true);
        else
          expect(() => patched.publicKey.verify(digest, signature)).toThrow(
            /Missing.*NULL/,
          );
      }
    },
  );

  it.each(["md5", "sha1", "sha256", "sha384", "sha512"])(
    "retains genuine %s signing, verification and wrong-message rejection",
    (algorithm) => {
      const md = patched.forge.md[algorithm].create();
      md.update(message);
      const signature = patched.privateKey.sign(md);
      const digest = md.digest().getBytes();
      expect(patched.publicKey.verify(digest, signature)).toBe(true);
      expect(original.publicKey.verify(digest, signature)).toBe(true);
      expect(
        nativeVerify(
          algorithm,
          Buffer.from(message),
          keys.publicKey,
          Buffer.from(signature, "latin1"),
        ),
      ).toBe(true);
      expect(
        patched.publicKey.verify("x".repeat(digest.length), signature),
      ).toBe(false);
    },
  );

  it("retains genuine RSA-PSS signing and verification", () => {
    const f = patched.forge;
    const scheme = f.pss.create({
      md: f.md.sha256.create(),
      mgf: f.mgf.mgf1.create(f.md.sha256.create()),
      saltLength: 20,
    });
    const md = f.md.sha256.create();
    md.update(message);
    const signature = patched.privateKey.sign(md, scheme);
    expect(patched.publicKey.verify(sha256, signature, scheme)).toBe(true);
    expect(patched.publicKey.verify("x".repeat(32), signature, scheme)).toBe(
      false,
    );
  });

  it("retains outer cardinality, trailing-byte and PKCS#1 padding guards", () => {
    const { der } = digestInfo(original.forge);
    const extra = digestInfo(original.forge, "sha256", "null", true).der;
    for (const payload of [extra, `${der}\x05\x00`]) {
      const signature = original.privateKey.sign(payload, "NONE");
      for (const f of [original, patched])
        expect(() => f.publicKey.verify(sha256, signature)).toThrow();
    }
    // Zero signature is not a correctly padded RSA block.
    expect(() =>
      patched.publicKey.verify(sha256, "\x00".repeat(128)),
    ).toThrow();
  });
});

// Parent runs this same file after the frozen install to exercise actual consumers.
describe("T02b node-forge installed-consumer mitigation", () => {
  it("rejects nested garbage through Expo CLI's actual installed forge", () => {
    const mobile = createRequire(
      resolve(import.meta.dirname, "../../apps/mobile/package.json"),
    );
    const expo = createRequire(mobile.resolve("expo"));
    const cli = createRequire(expo.resolve("@expo/cli"));
    const f = cli("node-forge") as Forge;
    const { der } = digestInfo(original.forge, "sha256", "extra");
    const signature = original.privateKey.sign(der, "NONE");
    expect(() =>
      f.pki.publicKeyFromPem(keys.publicKey).verify(sha256, signature),
    ).toThrow(/DigestInfo/);
  });
});
