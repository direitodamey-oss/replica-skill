// Leitura de arquivos no navegador. PDF e imagem viajam em base64 para o
// Claude ler direto; texto vira texto; .docx é descompactado aqui mesmo.

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
const IMAGE = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const TEXT_EXT = /\.(txt|md|csv|json|html?|xml|js|ts|py|sql|ya?ml|css|java|go|rb|php|c|cpp|cs|sh|log)$/i;

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function fileKind(name, mime) {
  if (IMAGE.includes(mime)) return 'image';
  if (mime === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
  if (/\.docx$/i.test(name)) return 'docx';
  if (TEXT_EXT.test(name) || (mime && mime.startsWith('text/'))) return 'text';
  return null;
}

export async function readAttachment(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name}: maior que 20 MB`);
  const kind = fileKind(file.name, file.type);
  if (!kind) throw new Error(`${file.name}: tipo não suportado`);
  if (kind === 'image') return { name: file.name, mime: file.type, data: toBase64(await file.arrayBuffer()) };
  if (kind === 'pdf') return { name: file.name, mime: 'application/pdf', data: toBase64(await file.arrayBuffer()) };
  if (kind === 'docx') return { name: file.name, mime: 'text/plain', text: await docxToText(await file.arrayBuffer()) };
  return { name: file.name, mime: 'text/plain', text: await file.text() };
}

// .docx é um zip; o texto está em word/document.xml.
export async function docxToText(buffer) {
  const xml = await unzipEntry(new Uint8Array(buffer), 'word/document.xml');
  return xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function unzipEntry(bytes, wanted) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('arquivo .docx inválido');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (name === wanted) {
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const data = bytes.subarray(start, start + size);
      if (method === 0) return decoder.decode(data);
      if (method !== 8) throw new Error('compressão de .docx não suportada');
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return decoder.decode(await new Response(stream).arrayBuffer());
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('não encontrei o texto dentro do .docx');
}

export function fileIcon(att) {
  if (att.mime && att.mime.startsWith('image/')) return '🖼️';
  if (att.mime === 'application/pdf') return '📄';
  return '📝';
}
