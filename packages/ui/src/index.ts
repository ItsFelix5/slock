// biome-ignore-all lint/performance/noBarrelFile: This is the UI package's public API entry point.
export type { AvatarProps, AvatarUser } from "./avatar/Avatar";
export { DEFAULT_AVATAR_COLOR, default as Avatar } from "./avatar/Avatar";
export type { AvatarStackProps } from "./avatar/AvatarStack";
export { default as AvatarStack } from "./avatar/AvatarStack";
export type { ButtonProps } from "./button/Button";
export { default as Button } from "./button/Button";
export type { ButtonGroupProps } from "./button/ButtonGroup";
export { default as ButtonGroup } from "./button/ButtonGroup";
export type { IconButtonProps } from "./button/IconButton";
export { default as IconButton } from "./button/IconButton";
export type { SegmentedControlProps } from "./button/SegmentedControl";
export { default as SegmentedControl } from "./button/SegmentedControl";
export { createDebouncedRequest, type DebouncedRequestOptions } from "./debouncedRequest";
export type { ConnectionStatusState } from "./feedback/ConnectionStatus";
export { default as ConnectionStatus } from "./feedback/ConnectionStatus";
export { createCopyFeedback } from "./feedback/copyFeedback";
export type { InlineFeedbackProps } from "./feedback/InlineFeedback";
export { default as InlineFeedback } from "./feedback/InlineFeedback";
export type { Feedback, FeedbackKind } from "./feedback/keyedFeedback";
export { createKeyedFeedback } from "./feedback/keyedFeedback";
export type { SkeletonProps } from "./feedback/Skeleton";
export { default as Skeleton } from "./feedback/Skeleton";
export type { TypingIndicatorProps } from "./feedback/TypingIndicator";
export { default as TypingIndicator } from "./feedback/TypingIndicator";
export { activeFontPreset, DEFAULT_FONT, FONT_PRESETS, type FontPreset } from "./fontPresets";
export type { ColorFieldProps } from "./form/ColorField";
export { default as ColorField } from "./form/ColorField";
export type { ComboItem } from "./form/FilterCombobox";
export { default as FilterCombobox } from "./form/FilterCombobox";
export {
  createListboxActiveIndex,
  gridNavigationIndex,
  listNavigationIndex,
  scrollActiveListOption,
} from "./form/listNavigation";
export type { OklchColorPickerProps } from "./form/OklchColorPicker";
export { default as OklchColorPicker } from "./form/OklchColorPicker";
export type { SliderProps } from "./form/Slider";
export { default as Slider } from "./form/Slider";
export type { SwitchProps } from "./form/Switch";
export { default as Switch } from "./form/Switch";
export type { FuzzyMatch, FuzzySearchOptions } from "./fuzzy";
export { fuzzyMatch, fuzzySearch } from "./fuzzy";
export type { PanelHeaderProps } from "./layout/PanelHeader";
export { default as PanelHeader } from "./layout/PanelHeader";
export { panelWantsFullscreen } from "./layout/panelWidth";
export { default as ResizeHandle } from "./layout/ResizeHandle";
export type { ConstrainedImageProps } from "./media/ConstrainedImage";
export { default as ConstrainedImage } from "./media/ConstrainedImage";
export type { MediaVolumeControl } from "./media/createMediaVolume";
export { createMediaVolume } from "./media/createMediaVolume";
export type { IconName } from "./media/Icon";
export { default as Icon, ICON_NAMES } from "./media/Icon";
export type { VideoPlayerProps } from "./media/VideoPlayer";
export { default as VideoPlayer } from "./media/VideoPlayer";
export type { VolumeControlProps } from "./media/VolumeControl";
export { default as VolumeControl } from "./media/VolumeControl";
export type { ZoomableImageProps } from "./media/ZoomableImage";
export { default as ZoomableImage } from "./media/ZoomableImage";
export { usePaneNavigation } from "./nav/paneNav";
export type {
  FloatingAlign,
  FloatingPanelProps,
  HorizontalPlacement,
  Placement,
  VerticalPlacement,
} from "./overlay/floating/FloatingPanel";
export {
  default as FloatingPanel,
  resolveHorizontalPlacement,
  resolveVerticalPlacement,
} from "./overlay/floating/FloatingPanel";
export { default as HoverCard, type HoverCardProps } from "./overlay/HoverCard";
export {
  default as Modal,
  ModalCloseButton,
  type ModalCloseButtonProps,
  ModalHeader,
  type ModalHeaderProps,
  type ModalProps,
} from "./overlay/Modal";
export type { ContextMenuProps } from "./overlay/menu/ContextMenu";
export { default as ContextMenu } from "./overlay/menu/ContextMenu";
export { default as Menu, type MenuProps } from "./overlay/menu/Menu";
export type { MenuButtonProps } from "./overlay/menu/MenuButton";
export { default as MenuButton } from "./overlay/menu/MenuButton";
export type { MenuItemProps } from "./overlay/menu/MenuItem";
export { default as MenuItem } from "./overlay/menu/MenuItem";
export { openContextMenuFromKeyboard, useContextMenu } from "./overlay/menu/useContextMenu";
export type { OverlayProps } from "./overlay/Overlay";
export { default as Overlay } from "./overlay/Overlay";
export type { PopoverProps } from "./overlay/Popover";
export { default as Popover } from "./overlay/Popover";
export type { TooltipProps } from "./overlay/Tooltip";
export { default as Tooltip } from "./overlay/Tooltip";
export {
  logDeletedMessages,
  type MessageSize,
  type MessageSizeMetrics,
  messageSize,
  messageSizeMetrics,
  setLogDeletedMessages,
  setMessageSize,
} from "./theme";
export {
  activePreset,
  applyCopiedThemePalette,
  applyPreset,
  copyableThemePalette,
  getEffectiveColor,
  resetThemeColor,
  resetThemeColors,
  setThemeColors,
  THEME_COLOR_KEYS,
  THEME_COLOR_LABELS,
  THEME_PRESETS,
  type ThemeColors,
  type ThemePreset,
  themeColors,
} from "./themeColors";
export {
  createDragSource,
  createDropZone,
  type DragSource,
  type DropZone,
} from "./tiling/dragDrop";
export { detectEdgeZone, type EdgeZone } from "./tiling/dragEdge";
export { distributeResize } from "./tiling/resize";
export {
  default as TileGroup,
  type TileGroupProps,
} from "./tiling/TileGroup";
export {
  type Axis,
  closeLeaf,
  createTileId,
  type Edge,
  findLeaf,
  findLeafBy,
  leaf,
  listLeaves,
  moveLeaf,
  replaceLeafContent,
  resizeSplit,
  splitLeaf,
  type TileLeaf,
  type TileNode,
  type TileSplit,
} from "./tiling/tree";
export { type ClickOutsideTarget, useClickOutside } from "./useClickOutside";
export { useEscapeClose } from "./useEscapeClose";
export {
  plainKey,
  type ShortcutDef,
  type ShortcutScope,
  shortcutsByScope,
  useShortcut,
} from "./useShortcut";
