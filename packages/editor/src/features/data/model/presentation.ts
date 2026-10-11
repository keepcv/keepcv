export interface DataPagePresentation {
  storageDescription: string;
  backupDescription: string;
  restoreDescription: string;
  showTerminalInstructions: boolean;
}

export const DEFAULT_DATA_PAGE: DataPagePresentation = {
  storageDescription: "Your store is saved on this machine. Download a backup before moving it.",
  backupDescription: "The launcher also saves a backup beside the store when it stops.",
  restoreDescription: "To restore a backup, start the launcher with an empty --data-dir.",
  showTerminalInstructions: true,
};
