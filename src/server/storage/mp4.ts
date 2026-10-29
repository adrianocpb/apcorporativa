// Lê a duração de um MP4 a partir da caixa "mvhd", percorrendo só os cabeçalhos das
// caixas (alguns bytes por caixa), mesmo em arquivos grandes. Assim a validação do vídeo
// assistido não depende da duração informada pelo navegador.

type ReadBytes = (start: number, length: number) => Promise<Buffer>;

async function findBox(read: ReadBytes, start: number, end: number, type: string) {
  let offset = start;
  while (offset + 8 <= end) {
    const header = await read(offset, 16);
    if (header.length < 8) return null;
    let size = header.readUInt32BE(0);
    const boxType = header.toString("latin1", 4, 8);
    let headerSize = 8;
    if (size === 1) {
      if (header.length < 16) return null;
      size = Number(header.readBigUInt64BE(8));
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerSize) return null;
    if (boxType === type) return { start: offset + headerSize, end: offset + size };
    offset += size;
  }
  return null;
}

export async function readMp4Duration(read: ReadBytes, fileSize: number): Promise<number | null> {
  try {
    const moov = await findBox(read, 0, fileSize, "moov");
    if (!moov) return null;
    const mvhd = await findBox(read, moov.start, moov.end, "mvhd");
    if (!mvhd) return null;
    const body = await read(mvhd.start, 32);
    const version = body.readUInt8(0);
    const timescale = version === 1 ? body.readUInt32BE(20) : body.readUInt32BE(12);
    const units = version === 1 ? Number(body.readBigUInt64BE(24)) : body.readUInt32BE(16);
    if (!timescale || !units) return null;
    const seconds = units / timescale;
    return Number.isFinite(seconds) && seconds > 0 && seconds < 24 * 3600 ? seconds : null;
  } catch {
    return null;
  }
}
