export {};

declare global {
  interface Window {
    electron?: {
      platform: NodeJS.Platform;
      openExternal: (url: string) => Promise<void>;
      minimizeWindow: () => Promise<void>;
      toggleMaximizeWindow: () => Promise<boolean>;
      isWindowMaximized: () => Promise<boolean>;
      closeWindow: () => Promise<void>;
    };
  }
}