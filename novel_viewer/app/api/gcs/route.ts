'use server';

import { GetFilesResponse, Storage as GCStorage} from '@google-cloud/storage';
import { NextResponse, NextRequest } from 'next/server';

const storageOptions = process.env.GCP_SERVICE_ACCOUNT_JSON
  ? { credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON) } // 배포 환경
  : { keyFilename: 'config.json' }; // 로컬 환경

const storage = new GCStorage(storageOptions);

export async function GET(request: NextRequest) {
  const bucketName = process.env.GCS_BUCKET_NAME!;
  const bucket = storage.bucket(bucketName);  
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action'); // 'list' 또는 'read'
  const path = searchParams.get('path') || ''; 

  try {
    if (action === 'read') {
      // 텍스트 파일 읽기 (소설 뷰어용)
      const file = bucket.file(path);
      const [content] = await file.download();
      // 한글 깨짐 방지를 위해 utf-8 처리 (필요시 iconv-lite 등으로 euc-kr 처리 필요)
      return NextResponse.json({ content: content.toString('utf-8') });
    } 
    
    if (action === 'stream') {
      // 미디어 파일을 서버에서 직접 다운로드하여 클라이언트로 전달 (Signed URL 권한 문제 회피)
      const file = bucket.file(path);
      const [buffer] = await file.download();
      
      let contentType = 'audio/mpeg'; // 기본값 (mp3)
      const lowerPath = path.toLowerCase();
      if (lowerPath.endsWith('.wav')) contentType = 'audio/wav';
      else if (lowerPath.endsWith('.ogg')) contentType = 'audio/ogg';
      else if (lowerPath.endsWith('.m4a')) contentType = 'audio/mp4';

      return new NextResponse(buffer as any, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': buffer.length.toString(),
          'Accept-Ranges': 'bytes'
        },
      });
    }

    if (action === 'url') {
      // 오디오, 이미지 등 미디어 파일용 서명된 URL 생성 (15분 유효)
      // 만약 500 에러(Signing IAM 권한 부족 등)가 발생하면 이 부분이 원인일 수 있습니다.
      try {
        const file = bucket.file(path);
        const [url] = await file.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 15 * 60 * 1000,
        });
        return NextResponse.json({ url });
      } catch (signError: any) {
        console.error("Signed URL Error:", signError);
        // 서명된 URL 생성이 실패할 경우(로컬 ADC 환경 등) 직접 스트리밍하는 방식으로 전환합니다.
        return NextResponse.json({ 
          error: 'Signed URL Failed', 
          details: signError.message || String(signError) 
        }, { status: 500 });
      }
    }

    if (action === 'list') {
      // 폴더 및 파일 목록 조회
      // delimiter '/'를 사용해야 하위 폴더 내용까지 한 번에 가져오지 않습니다.
      const [files, , apiResponse] : GetFilesResponse = await bucket.getFiles({
        prefix: path,
        delimiter: '/',
        autoPaginate: false,
      });

      // apiResponse.prefixes에 가상 폴더 목록이 들어옵니다.
      const folders = (apiResponse as { prefixes?: string[] })?.prefixes || [];
      // 현재 path 자기 자신(폴더명)은 제외하고 실제 파일만 필터링
      const fileList = files
        .map(f => f.name)
        .filter(name => name !== path && !name.endsWith('/'));

      return NextResponse.json({ folders, files: fileList });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error("GCS Error:", error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: error.message || String(error) 
    }, { status: 500 });
  }
}
