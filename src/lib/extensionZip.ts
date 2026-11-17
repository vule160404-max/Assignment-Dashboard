import JSZip from 'jszip';
import manifestRaw from '../../extension/hix-bridge/manifest.json?raw';
import bridgeRaw from '../../extension/hix-bridge/bridge.js?raw';
import backgroundRaw from '../../extension/hix-bridge/background.js?raw';
import hixContentRaw from '../../extension/hix-bridge/hix_content.js?raw';
import popupHtmlRaw from '../../extension/hix-bridge/popup.html?raw';
import popupJsRaw from '../../extension/hix-bridge/popup.js?raw';

/**
 * Packages the AssignTrack HIX Bridge Chrome Extension directly in the browser.
 * Guarantees 100% download availability even on static CDNs or before backend APIs spin up.
 */
export async function buildExtensionZipBlob(): Promise<Blob> {
  const zip = new JSZip();
  zip.file('manifest.json', manifestRaw);
  zip.file('bridge.js', bridgeRaw);
  zip.file('background.js', backgroundRaw);
  zip.file('hix_content.js', hixContentRaw);
  zip.file('popup.html', popupHtmlRaw);
  zip.file('popup.js', popupJsRaw);

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    mimeType: 'application/zip',
  });
}
