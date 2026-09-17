// 백엔드 AccessControl.isAllowedAttachment()가 ISSUE_COMMENT/NONISSUE_COMMENT 컨테이너
// 타입을 지원하지 않아(else -> false) 기존 GET /files 비동기 조회 방식은 항상 403이 난다.
// 그래서 서버가 이미 렌더링해둔 마커 엘리먼트(.attached-file-marker)를 마운트 시점에
// 한 번 읽어 files 배열을 직접 채운다(추가 네트워크 요청 없이).
export interface AttachmentMarker {
  id: string;
  name: string;
  href: string;
  mime: string;
  size: string;
}

export interface MarkerFile {
  submitId: string;
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  progress: number;
}

export function markersToFiles(markers: AttachmentMarker[]): MarkerFile[] {
  return markers.map((marker) => ({
    submitId: marker.id,
    id: marker.id,
    name: marker.name,
    url: marker.href,
    mimeType: marker.mime,
    size: Number(marker.size) || 0,
    progress: 100,
  }));
}
