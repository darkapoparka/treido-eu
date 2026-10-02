"use client";
import { useEffect, useRef, useState } from "react";
import { useDiscovery } from "./state";
import { useSheetStages } from "./sheet-stages";

export function useProductSaving(productId: string) {
  const state = useDiscovery();
  const [picker, setPicker] = useState(false),
    [name, setName] = useState(""),
    [toast, setToast] = useState(false);
  const pickerSubmitting = useRef(false);
  const pickerFlow = useSheetStages<"picker" | "create">({
    open: picker,
    initial: "picker",
    onClose: () => {
      setPicker(false);
      if (picker && state.saved.includes(productId)) setToast(true);
    },
    onReopen: () => {
      pickerSubmitting.current = false;
      setPicker(true);
    },
    onStart: () => {
      setName("");
      pickerSubmitting.current = false;
    },
  });
  const creating = pickerFlow.stage === "create";
  function saveTo(id?: string, newName?: string) {
    if (pickerSubmitting.current) return;
    pickerSubmitting.current = true;
    pickerFlow.close(() => {
      if (!state.saved.includes(productId)) state.toggleSaved(productId);
      if (newName) state.createCollection(newName, [productId]);
      else if (id) {
        const collection = state.collections.find((item) => item.id === id);
        if (collection && !collection.productIds.includes(productId))
          state.updateCollection(id, {
            productIds: [...collection.productIds, productId],
          });
      }
      setToast(true);
    });
  }
  const previousPickerStage = useRef(creating);
  useEffect(() => {
    const fromEditor = previousPickerStage.current;
    previousPickerStage.current = creating;
    if (!pickerFlow.active) return;
    const frame = requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          creating
            ? '.product-save-picker[open] input[data-ui-label="collectionName"]'
            : fromEditor
              ? ".product-save-picker[open] [data-picker-create]"
              : ".product-save-picker[open] .picker-row",
        )
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [creating, pickerFlow.active]);
  return {
    picker,
    setPicker,
    name,
    setName,
    toast,
    setToast,
    pickerFlow,
    creating,
    saveTo,
  };
}
