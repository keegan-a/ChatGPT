export {}

declare global {
  interface Window {
    chrome?: {
      printing?: {
        getPrinters: (callback: (printers: Array<{ id: string; isDefault?: boolean }>) => void) => void
        getPrinterCapabilities: (
          id: string,
          callback: (capabilities: {
            media_size?: {
              option?: Array<{
                name?: string
                custom_display_name?: string
                width_microns?: number
                height_microns?: number
                is_default?: boolean
              }>
            }
          }) => void,
        ) => void
      }
    }
  }
}
