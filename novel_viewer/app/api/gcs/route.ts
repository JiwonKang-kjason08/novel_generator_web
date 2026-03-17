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

  } catch (error) {
    console.error("GCS Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
