import { defineConfig } from "vite";

export default defineConfig({
  // Electron의 file:// 프로토콜에서도 빌드 자산을 상대 경로로 찾습니다.
  base: "./",
});
