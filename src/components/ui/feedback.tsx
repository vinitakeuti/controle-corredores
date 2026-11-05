import { Icon } from "@/components/ui/icon";

// Retorno de uma ação. As regiões ficam sempre no DOM para o leitor de tela anunciar quando o texto muda:
// sucesso de forma educada (aria-live="polite"), erro de forma imediata (role="alert").
export function Feedback({ success, error }: { success?: React.ReactNode; error?: React.ReactNode }) {
  return (
    <>
      <div className="feedback" aria-live="polite">
        {success ? <p className="message" data-tone="positive"><Icon name="check" /><span>{success}</span></p> : null}
      </div>
      <div className="feedback" role="alert">
        {error ? <p className="message" data-tone="danger"><Icon name="alert" /><span>{error}</span></p> : null}
      </div>
    </>
  );
}
