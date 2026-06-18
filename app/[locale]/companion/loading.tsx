import { BrandedLoadingPage } from "@/components/branded-loading-page";

export default function CompanionLoading() {
  return (
    <BrandedLoadingPage
      eyebrow="응답 준비 중"
      title="성경의 연결을 따라가고 있어요"
      description="질문에 맞는 본문, 문맥, 상호참조, 근거 기반 해설을 한 화면으로 정리하는 중입니다."
      steps={["질문 분석", "본문 연결", "근거 정리"]}
    />
  );
}
