import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('beheart', {
  load: () => ipcRenderer.invoke('data:load'),
  save: (data: unknown) => ipcRenderer.invoke('data:save', data),
  dataLocation: () => ipcRenderer.invoke('data:location'),
  exportData: (data: unknown) => ipcRenderer.invoke('data:export', data),
  importAppleHealth: (age: number) => ipcRenderer.invoke('health:import', age),
  searchFood: (query: string) => ipcRenderer.invoke('food:search', query),
  lookupBarcode: (code: string) => ipcRenderer.invoke('food:barcode', code),
  isScreenshot: () => ipcRenderer.invoke('app:isScreenshot'),
  startOptions: () => ipcRenderer.invoke('app:startOptions'),
});
