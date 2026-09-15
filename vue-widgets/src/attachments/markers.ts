// yona.CommentAttachmentsUpdate.js 흡수 작업의 일부 - 댓글 수정 폼은 이미 서버가
// (commentAttachmentsByCommentId 모델 속성으로) 첨부파일 목록을 갖고 있는데,
// 백엔드 AccessControl.isAllowedAttachment()가 ISSUE_COMMENT/NONISSUE_COMMENT
// 컨테이너 타입을 지원하지 않아(when 분기 없음, else -> false) 기존
// resourceType/resourceId 기반 GET /files 비동기 조회 방식은 항상 403이 난다
// (백엔드 보안 코드를 건드리는 건 이 세션의 스코프 밖) - 그래서 서버가 이미
// 렌더링해둔 마커 엘리먼트(.attached-file-marker, data-id/name/href/mime/size)를
// host의 라이트 DOM 자식으로 그대로 두고 마운트 시점에 한 번 읽어 files 배열을
// 직접 채운다(추가 네트워크 요청 없이).
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
