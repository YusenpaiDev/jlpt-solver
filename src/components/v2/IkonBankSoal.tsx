/* Ikon Bank Soal dari mockup Rencana Belajar (lembar soal bertumpuk + centang).
   Props sama kayak ikon lucide biar bisa ditaruh di daftar nav yang sama. */
export function IkonBankSoal({ size = 24, strokeWidth = 2, className, ...rest }: {
  size?: number; strokeWidth?: number; className?: string; "aria-hidden"?: boolean | "true";
}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...rest}>
      <rect x="4" y="3" width="13" height="16" rx="2" />
      <path d="M8 21h10a2 2 0 0 0 2-2V7" />
      <path d="M8 8h5M8 12h5" />
      <path d="m8 15.5 1.2 1.2L11.5 14" />
    </svg>
  );
}
