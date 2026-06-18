import { BrandedLoadingPage } from "@/components/branded-loading-page";

export default function Loading() {
  return (
    <BrandedLoadingPage
      eyebrow="페이지 준비 중"
      title="성경 본문을 불러오는 중입니다"
      description="본문, 문맥, 연결 본문 데이터를 읽기 좋은 화면으로 준비하고 있습니다."
      steps={["본문 확인", "문맥 정리", "연결 본문"]}
    />
  );
}
