'use client';

/**
 * 라이브러리: react
 * 설명: 사용자 인터페이스를 만들기 위한 JavaScript/TypeScript 라이브러리입니다.
 * 모듈/함수:
 *  - useState: 컴포넌트 내에서 상태 값을 관리하기 위해 사용하는 React Hook입니다.
 *  - useEffect: 컴포넌트가 렌더링된 이후에 부수 효과(네트워크 요청 등)를 처리하기 위해 사용하는 React Hook입니다.
 *  - Suspense: 하위 컴포넌트가 로드될 때까지 대기 화면(fallback)을 보여주는 React 컴포넌트입니다.
 * 
 * 라이브러리: next/navigation
 * 설명: Next.js 13+ App Router 환경에서 클라이언트 사이드 라우팅과 URL 파라미터 조작을 담당하는 모듈입니다.
 * 모듈/함수:
 *  - useRouter: 프로그래밍 방식으로 라우트를 변경(push, back 등)할 수 있게 해주는 Hook입니다.
 *  - useSearchParams: 현재 URL의 쿼리 스트링 파라미터를 읽어올 수 있게 해주는 Hook입니다.
 */
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Author: Jiwon Kang
 * 
 * URL의 쿼리 파라미터를 기반으로 구글 클라우드 스토리지(GCS)의 파일 목록을 조회하고,
 * 선택한 텍스트나 오디오 파일을 화면에 렌더링하는 핵심 뷰어 컴포넌트입니다.
 * 
 * @returns {JSX.Element} 뷰어의 메인 콘텐츠 리액트 컴포넌트
 */
function NovelViewerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // URL 파라미터에서 현재 경로와 선택된 파일 정보를 가져옵니다.
  const currentPath = searchParams.get('path') || '';
  const currentFile = searchParams.get('file') || null;

  const [folders, setFolders] = useState<string[]>([]); // 하위 폴더 목록
  const [files, setFiles] = useState<string[]>([]); // 현재 경로의 파일 목록
  
  const [fileContent, setFileContent] = useState<string | null>(null); // 선택된 텍스트 파일의 내용
  const [audioUrl, setAudioUrl] = useState<string | null>(null); // 선택된 오디오 파일의 재생 서명된 URL
  const [currentFileName, setCurrentFileName] = useState<string>(''); // 현재 뷰어에 표시 중인 파일의 이름
  
  const [loading, setLoading] = useState<boolean>(false); // 로딩 상태 플래그

  /**
   * 컴포넌트가 마운트되거나 currentPath 상태가 변경될 때마다 하위 목록을 가져옵니다.
   * 파일이 선택된 상태(currentFile이 존재함)에서는 목록 갱신을 하지 않습니다.
   */
  useEffect(() => {
    if (currentFile) return; 
    
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
  }, [currentPath, currentFile]);

  /**
   * 선택된 파일(currentFile)이 변경될 때마다 파일의 내용을 가져오거나 오디오 URL을 설정합니다.
   */
  useEffect(() => {
    if (!currentFile) {
      // 파일이 선택되지 않은 경우 뷰어 상태 초기화
      setFileContent(null);
      setAudioUrl(null);
      setCurrentFileName('');
      return;
    }

    /**
     * API를 호출하여 텍스트 파일 내용을 읽거나 오디오 스트리밍 주소를 설정합니다.
     */
    const fetchFile = async () => {
      setLoading(true);
      setCurrentFileName(currentFile.replace(currentPath, '')); // 전체 경로에서 현재 경로를 제외하여 파일명만 설정
      
      // 오디오 파일인지 판단합니다 (mp3, wav, ogg, m4a 등 대소문자 구분 없이 매칭)
      const isAudio = /\.(mp3|wav|ogg|m4a)$/i.test(currentFile);
      
      try {
        if (isAudio) {
          // 오디오 파일인 경우 스트리밍 API 엔드포인트를 설정합니다.
          const streamUrl = `/api/gcs?action=stream&path=${encodeURIComponent(currentFile)}`;
          setAudioUrl(streamUrl);
        } else {
          // 텍스트 파일인 경우 파일 내용 텍스트를 가져옵니다.
          const res = await fetch(`/api/gcs?action=read&path=${encodeURIComponent(currentFile)}`);
          if (!res.ok) {
            const text = await res.text();
            console.error("Text Read Fetch Error:", res.status, text);
            alert(`텍스트 파일을 읽는 중 서버 에러가 발생했습니다. (${res.status})\n${text}`);
            setLoading(false);
            return;
          }
          const data = await res.json();
          setFileContent(data.content);
        }
      } catch (error) {
        console.error("fetchFile Error:", error);
        alert(`파일 처리 중 오류가 발생했습니다.\n${error}`);
      } finally {
        setLoading(false);
      }
    };

    fetchFile();
  }, [currentFile, currentPath]);

  /**
   * 폴더 항목을 클릭했을 때 URL을 변경하여 하위 폴더로 이동합니다.
   * 브라우저 히스토리에 기록되므로 뒤로가기 버튼이 정상 작동합니다.
   * 
   * @param {string} folder - 이동할 폴더의 경로
   */
  const handleFolderClick = (folder: string) => {
    router.push(`/?path=${encodeURIComponent(folder)}`);
  };

  /**
   * 파일 항목을 클릭했을 때 URL을 변경하여 파일 뷰어를 엽니다.
   * 
   * @param {string} filePath - 선택된 파일의 전체 경로
   */
  const handleFileClick = (filePath: string) => {
    router.push(`/?path=${encodeURIComponent(currentPath)}&file=${encodeURIComponent(filePath)}`);
  };

  /**
   * 화면 내의 '상위로' 또는 '목록으로 돌아가기' 버튼을 눌렀을 때의 동작입니다.
   * 브라우저의 뒤로가기 버튼과 유사하게 동작하도록 URL을 상위 경로로 변경합니다.
   */
  const handleBack = () => {
    if (currentFile) {
      // 파일 뷰어가 열려있을 때는 현재 폴더 경로로 돌아갑니다.
      router.push(`/?path=${encodeURIComponent(currentPath)}`);
    } else {
      // 폴더 목록 상태일 때는 상위 폴더 경로를 계산하여 이동합니다.
      const pathArray = currentPath.split('/').filter(Boolean);
      pathArray.pop(); 
      const parentPath = pathArray.length > 0 ? pathArray.join('/') + '/' : '';
      router.push(`/?path=${encodeURIComponent(parentPath)}`);
    }
  };

  // 텍스트 또는 오디오 뷰어 렌더링
  if (currentFile) {
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
                onClick={() => handleFolderClick(folder)}>
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

/**
 * Author: Jiwon Kang
 * 
 * useSearchParams를 사용하는 컴포넌트는 Suspense 경계 내부에 있어야 하므로,
 * 이를 감싸주는 최상위 래퍼 컴포넌트입니다.
 * 
 * @returns {JSX.Element} NovelViewer 래퍼 리액트 컴포넌트
 */
export default function NovelViewer() {
  return (
    <Suspense fallback={<div className="p-4 text-center">로딩 중...</div>}>
      <NovelViewerContent />
    </Suspense>
  );
}
