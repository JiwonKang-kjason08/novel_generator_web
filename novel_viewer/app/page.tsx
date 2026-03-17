'use client';

import { useState, useEffect } from 'react';

export default function NovelViewer() {
  const [currentPath, setCurrentPath] = useState<string>(''); // 현재 경로
  const [folders, setFolders] = useState<string[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [fileContent, setFileContent] = useState<string | null>(null); // 선택된 파일 내용
  const [loading, setLoading] = useState<boolean>(false);

  // 현재 경로(currentPath)가 바뀔 때마다 하위 목록을 가져옵니다.
  useEffect(() => {
    if (fileContent !== null) return; // 뷰어 모드일 때는 목록 갱신 안 함
    
    const fetchList = async () => {
      setLoading(true);
      const res = await fetch(`/api/gcs?action=list&path=${encodeURIComponent(currentPath)}`);
      const data = await res.json();
      setFolders(data.folders);
      setFiles(data.files);
      setLoading(false);
    };

    fetchList();
  }, [currentPath, fileContent]);

  // 파일 클릭 시 텍스트 내용 가져오기
  const handleFileClick = async (filePath: string) => {
    setLoading(true);
    const res = await fetch(`/api/gcs?action=read&path=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    setFileContent(data.content);
    setLoading(false);
  };

  // 상위 폴더로 이동 또는 뷰어 닫기
  const handleBack = () => {
    if (fileContent !== null) {
      setFileContent(null); // 뷰어 닫기
    } else {
      // 경로 계산 로직: '소설1/폴더1/' -> '소설1/'
      const pathArray = currentPath.split('/').filter(Boolean);
      pathArray.pop(); 
      setCurrentPath(pathArray.length > 0 ? pathArray.join('/') + '/' : '');
    }
  };

  // 텍스트 뷰어 렌더링
  if (fileContent !== null) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <button onClick={handleBack} className="mb-4 text-blue-500 font-bold">← 목록으로 돌아가기</button>
        {loading ? <p>로딩 중...</p> : <pre className="whitespace-pre-wrap font-sans leading-relaxed">{fileContent}</pre>}
      </div>
    );
  }

  // 목록 렌더링
  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        {currentPath === '' ? '소설 목록' : `현재 경로: ${currentPath}`}
      </h1>
      
      {currentPath !== '' && (
        <button onClick={handleBack} className="mb-4 text-blue-500 font-bold">← 상위로</button>
      )}

      {loading ? (
        <p>로딩 중...</p>
      ) : (
        <ul className="space-y-2">
          {/* 폴더(소설명/하위폴더명) 출력 */}
          {folders.map(folder => (
            <li key={folder} 
                className="cursor-pointer bg-gray-100 p-3 rounded hover:bg-gray-200 transition"
                onClick={() => setCurrentPath(folder)}>
              📁 {folder.replace(currentPath, '')} 
            </li>
          ))}
          
          {/* 파일(텍스트 파일) 출력 */}
          {files.map(file => (
            <li key={file} 
                className="cursor-pointer bg-blue-50 p-3 rounded hover:bg-blue-100 transition"
                onClick={() => handleFileClick(file)}>
              📄 {file.replace(currentPath, '')}
            </li>
          ))}
          
          {folders.length === 0 && files.length === 0 && <li>항목이 없습니다.</li>}
        </ul>
      )}
    </div>
  );
}