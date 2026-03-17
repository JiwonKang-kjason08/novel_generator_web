'use client';

/**
 * 라이브러리: react
 * 설명: 사용자 인터페이스를 만들기 위한 JavaScript/TypeScript 라이브러리입니다.
 * 모듈/함수:
 *  - useState: 컴포넌트 내에서 상태 값을 관리하기 위해 사용하는 React Hook입니다.
 *  - useEffect: 컴포넌트가 렌더링된 이후에 부수 효과(네트워크 요청 등)를 처리하기 위해 사용하는 React Hook입니다.
 */
import { useState, useEffect } from 'react';

/**
 * Author: Jiwon Kang
 * 
 * 구글 클라우드 스토리지(GCS)에서 텍스트 파일과 오디오 파일을 목록화하고
 * 선택한 파일을 보여주거나 재생하는 뷰어 컴포넌트입니다.
 * 
 * @returns {JSX.Element} NovelViewer 리액트 컴포넌트
 */
export default function NovelViewer() {
  const [currentPath, setCurrentPath] = useState<string>(''); // 현재 디렉토리 경로
  const [folders, setFolders] = useState<string[]>([]); // 하위 폴더 목록
  const [files, setFiles] = useState<string[]>([]); // 현재 경로의 파일 목록
  
  const [fileContent, setFileContent] = useState<string | null>(null); // 선택된 텍스트 파일의 내용
  const [audioUrl, setAudioUrl] = useState<string | null>(null); // 선택된 오디오 파일의 재생 서명된 URL
  const [currentFileName, setCurrentFileName] = useState<string>(''); // 현재 뷰어에 표시 중인 파일의 이름
  
  const [loading, setLoading] = useState<boolean>(false); // 로딩 상태 플래그

  /**
   * 컴포넌트가 마운트되거나 currentPath 상태가 변경될 때마다 하위 목록을 가져옵니다.
   * 뷰어 모드(텍스트가 열려 있거나 오디오가 선택된 상태)에서는 목록 갱신을 하지 않습니다.
   */
  useEffect(() => {
    // 텍스트 또는 오디오 뷰어 모드일 때는 목록 갱신 생략
    if (fileContent !== null || audioUrl !== null) return; 
    
    /**
     * API를 호출하여 현재 경로 내의 폴더와 파일 목록을 가져옵니다.
     */
    const fetchList = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/gcs?action=list&path=${encodeURIComponent(currentPath)}`);
        if (!res.ok) {
          const text = await res.text();
          console.error("fetchList API Error:", res.status, text);
          alert(`서버 에러가 발생했습니다. (${res.status})\n${text}`);
          setLoading(false);
          return;
        }
        const data = await res.json();
        setFolders(data.folders);
        setFiles(data.files);
      } catch (error) {
        console.error("fetchList Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchList();
  }, [currentPath, fileContent, audioUrl]);

  /**
   * 파일 항목을 클릭했을 때 호출되는 핸들러입니다.
   * 확장자에 따라 텍스트 파일을 읽어오거나 오디오 파일 스트리밍 URL을 요청합니다.
   * 
   * @param {string} filePath - 선택된 파일의 전체 경로
   */
  const handleFileClick = async (filePath: string) => {
    setLoading(true);
    setCurrentFileName(filePath.replace(currentPath, '')); // 전체 경로에서 현재 경로를 제외하여 파일명만 설정
    
    // 오디오 파일인지 판단합니다 (mp3, wav, ogg, m4a 등 대소문자 구분 없이 매칭)
    const isAudio = /\.(mp3|wav|ogg|m4a)$/i.test(filePath);
    
    try {
      if (isAudio) {
        // 오디오 파일인 경우, 500 에러를 유발할 수 있는 Signed URL 생성 대신 
        // 서버의 스트리밍 API 엔드포인트를 오디오 소스로 직접 설정합니다.
        const streamUrl = `/api/gcs?action=stream&path=${encodeURIComponent(filePath)}`;
        setAudioUrl(streamUrl); // 오디오 URL 상태에 서버 스트리밍 주소 저장
      } else {
        // 텍스트 파일인 경우, 파일 내용 텍스트를 바로 가져옵니다.
        const res = await fetch(`/api/gcs?action=read&path=${encodeURIComponent(filePath)}`);
        if (!res.ok) {
          const text = await res.text();
          console.error("Text Read Fetch Error:", res.status, text);
          alert(`텍스트 파일을 읽는 중 서버 에러가 발생했습니다. (${res.status})\n${text}`);
          setLoading(false);
          return;
        }
        const data = await res.json();
        setFileContent(data.content); // 텍스트 내용 상태에 저장
      }
    } catch (error) {
      console.error("handleFileClick Error:", error);
      alert(`파일 처리 중 오류가 발생했습니다.\n${error}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 상위 폴더로 이동하거나 열려있는 뷰어(텍스트/오디오)를 닫습니다.
   */
  const handleBack = () => {
    if (fileContent !== null || audioUrl !== null) {
      setFileContent(null); // 텍스트 뷰어 닫기
      setAudioUrl(null);    // 오디오 뷰어 닫기
      setCurrentFileName(''); // 현재 표시 파일명 초기화
    } else {
      // 경로 계산 로직: '소설1/폴더1/' 에서 상위로 이동 시 '소설1/' 로 변경
      const pathArray = currentPath.split('/').filter(Boolean);
      pathArray.pop(); 
      setCurrentPath(pathArray.length > 0 ? pathArray.join('/') + '/' : '');
    }
  };

  // 텍스트 또는 오디오 뷰어 렌더링
  if (fileContent !== null || audioUrl !== null) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <button onClick={handleBack} className="mb-4 text-blue-500 font-bold">← 목록으로 돌아가기</button>
        
        <h2 className="text-xl font-bold mb-4">{currentFileName}</h2>
        
        {loading ? (
          <p>로딩 중...</p>
        ) : audioUrl !== null ? (
          // 오디오 뷰어 렌더링
          <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded shadow-inner">
            <audio controls autoPlay src={audioUrl} className="w-full max-w-md">
              사용 중인 브라우저가 오디오 태그를 지원하지 않습니다.
            </audio>
          </div>
        ) : (
          // 텍스트 뷰어 렌더링
          <pre className="whitespace-pre-wrap font-sans leading-relaxed">{fileContent}</pre>
        )}
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
          
          {/* 파일(텍스트 파일 및 오디오 파일) 출력 */}
          {files.map(file => {
            const isAudio = /\.(mp3|wav|ogg|m4a)$/i.test(file);
            return (
              <li key={file} 
                  className="cursor-pointer bg-blue-50 p-3 rounded hover:bg-blue-100 transition"
                  onClick={() => handleFileClick(file)}>
                {isAudio ? '🎵' : '📄'} {file.replace(currentPath, '')}
              </li>
            );
          })}
          
          {folders.length === 0 && files.length === 0 && <li>항목이 없습니다.</li>}
        </ul>
      )}
    </div>
  );
}
