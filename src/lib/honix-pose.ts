/** Pose Honix → file di public/honix/ (PNG transparan 1254×1254). */
export type HonixPose =
  | "senang" | "baca" | "terbang" | "tidur" | "tunggu"
  | "lulus" | "bangkit" | "tunjuk" | "kepala";

const FILE: Record<HonixPose, string> = {
  senang: "01-senang", baca: "02-baca", terbang: "03-terbang", tidur: "04-tidur",
  tunggu: "05-menunggu", lulus: "06-lulus", bangkit: "07-bangkit",
  tunjuk: "08-menunjuk", kepala: "09-kepala",
};

export const honixSrc = (pose: HonixPose) => `/honix/${FILE[pose]}.png`;
