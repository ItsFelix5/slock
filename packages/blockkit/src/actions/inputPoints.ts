import type { RichTextBlock } from "@slock/types";
import type { Component } from "solid-js";

export type RichTextInputProps = {
  disabled?: boolean;
  initial?: RichTextBlock;
  onChange: (value: RichTextBlock) => void;
  placeholder?: string;
};

export type FileInputProps = {
  disabled?: boolean;
  filetypes?: string[];
  maxFiles?: number;
  onChange: (files: { id: string }[]) => void;
};

declare module "@slock/core/types" {
  interface Points {
    "blockkit.fileInput": Component<FileInputProps>;
    "blockkit.richTextInput": Component<RichTextInputProps>;
  }
}
