import {
  FinderPage,
  type ToolPageProps,
} from "@/features/shopping-tools/entry.server";
export default function Page(props: ToolPageProps) {
  return <FinderPage {...props} mode="find-for-me" />;
}
