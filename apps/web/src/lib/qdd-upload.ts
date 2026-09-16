import { NextResponse } from 'next/server';

export const MAX_QDD_UPLOAD_BYTES = 20 * 1024 * 1024;

function badUpload(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

function uploadTooLarge() {
  return NextResponse.json(
    { message: 'O arquivo QDD deve ter no máximo 20 MB.' },
    { status: 413 },
  );
}

/** Limita o corpo inteiro antes de chamar o parser multipart ou alocar o arquivo. */
export async function readQddFormData(
  request: Request,
  maxBytes = MAX_QDD_UPLOAD_BYTES,
): Promise<{ formData: FormData; response?: never } | { formData?: never; response: NextResponse }> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data;')) {
    return { response: badUpload('Envie o arquivo como formulário multipart.') };
  }

  const declaredSize = Number(request.headers.get('content-length'));
  if (declaredSize > maxBytes) return { response: uploadTooLarge() };
  if (!request.body) return { response: badUpload('Envie um arquivo QDD no campo file.') };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return { response: uploadTooLarge() };
      }
      chunks.push(value);
    }

    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const formData = await new Response(body, { headers: { 'content-type': contentType } }).formData();
    return { formData };
  } catch {
    return { response: badUpload('Formulário de upload inválido.') };
  } finally {
    reader.releaseLock();
  }
}
