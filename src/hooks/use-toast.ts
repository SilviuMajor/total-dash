import { toast as sonnerToast } from "sonner";

type ToastInput = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive";
};

function toast({ title, description, variant }: ToastInput) {
  const message = (title ?? description ?? "") as string;
  const opts = title && description ? { description: description as string } : undefined;
  const id =
    variant === "destructive"
      ? sonnerToast.error(message, opts)
      : sonnerToast.success(message, opts);

  return {
    id: String(id),
    dismiss: () => sonnerToast.dismiss(id),
  };
}

function useToast() {
  return {
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
    toasts: [] as Array<{ id: string }>,
  };
}

export { useToast, toast };
