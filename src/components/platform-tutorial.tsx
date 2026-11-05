"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";

type Role = "ADMIN" | "MANAGER" | "OPERATOR" | "STUDENT";
type FocusRect = { top: number; left: number; width: number; height: number };
type TutorialStep = { label: string; title: string; text: string; anchors?: string[] };

const adminSteps: TutorialStep[] = [
  { label: "Bem-vindo", title: "É bom ter você no time.", text: "A Pace Lab organiza a rotina financeira para você manter o foco no que acontece fora da tela." },
  { label: "Planos", title: "Planos e valores.", text: "Crie os serviços, períodos e preços que os alunos poderão escolher. Valores especiais são definidos no perfil individual.", anchors: ["[data-tutorial-anchor='nav-plans']"] },
  { label: "Alunos", title: "Cada aluno, no ritmo certo.", text: "No cadastro você define os métodos aceitos. Pix, Pix Automático, cartão e boleto ficam disponíveis conforme essa escolha.", anchors: ["[data-tutorial-anchor='nav-students']"] },
  { label: "Segurança", title: "Seu acesso é pessoal.", text: "Mantenha sua senha protegida e encerre a sessão neste menu sempre que usar um computador compartilhado.", anchors: ["[data-tutorial-anchor='account-menu']"] },
];

const studentSteps: TutorialStep[] = [
  { label: "Bem-vindo", title: "É bom ter você no time.", text: "Aqui você acompanha sua assinatura e mantém o treino em movimento, do seu jeito.", anchors: ["[data-tutorial-anchor='student-heading']"] },
  { label: "Pix", title: "Pix para este pagamento.", text: "Gere o QR Code, pague no app do banco e sua assinatura é liberada após a confirmação.", anchors: ["[data-tutorial-anchor='payment-methods']", "[data-tutorial-anchor='nav-student']"] },
  { label: "Pix Automático", title: "Pix Automático para a rotina.", text: "Autorize uma vez no banco para que as próximas mensalidades sejam cobradas na data combinada. A autorização pode ser cancelada no seu banco.", anchors: ["[data-tutorial-anchor='payment-methods']", "[data-tutorial-anchor='nav-student']"] },
  { label: "Cartão e boleto", title: "Outras formas de pagar.", text: "No cartão, você conclui os dados em ambiente seguro. No boleto, gere o documento e pague até o vencimento.", anchors: ["[data-tutorial-anchor='payment-methods']", "[data-tutorial-anchor='nav-student']"] },
  { label: "Segurança", title: "Sua conta é só sua.", text: "Use uma senha que só você conhece e altere-a nesta área sempre que precisar.", anchors: ["[data-tutorial-anchor='security']", "[data-tutorial-anchor='nav-student']"] },
];

const operatorSteps: TutorialStep[] = [
  { label: "Bem-vindo", title: "É bom ter você no time.", text: "Você tem acesso às rotinas de alunos e pagamentos da Pace Lab." },
  { label: "Alunos", title: "Cadastros no ritmo certo.", text: "Crie novos alunos ou gere links de pagamento a partir desta área.", anchors: ["[data-tutorial-anchor='nav-students']"] },
  { label: "Analisar dados", title: "Acompanhe as assinaturas.", text: "Use a análise para localizar alunos em dia, em atraso ou aguardando pagamento." },
  { label: "Segurança", title: "Seu acesso é pessoal.", text: "Mantenha sua senha protegida e encerre a sessão ao terminar o atendimento.", anchors: ["[data-tutorial-anchor='account-menu']"] },
];

function findFocus(anchors?: string[]) {
  if (!anchors) return null;
  for (const anchor of anchors) {
    // O mesmo item pode existir no menu lateral e na navegação do celular: usa o que está visível.
    for (const element of document.querySelectorAll(anchor)) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return { top: Math.max(8, rect.top - 8), left: Math.max(8, rect.left - 8), width: rect.width + 16, height: rect.height + 16 };
      }
    }
  }
  return null;
}

export function PlatformTutorial({ role, name, userId, initiallySeen }: { role: Role; name: string; userId: string; initiallySeen: boolean }) {
  const steps = role === "ADMIN" ? adminSteps : role === "MANAGER" || role === "OPERATOR" ? operatorSteps : studentSteps;
  const storageKey = `pace-lab:tutorial-seen:v1:${role}:${userId}`;
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [iphoneOffer, setIphoneOffer] = useState(false);
  const [iphoneGuideOpen, setIphoneGuideOpen] = useState(false);
  const [iphoneStep, setIphoneStep] = useState(0);
  const [focus, setFocus] = useState<FocusRect | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  function close() {
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    if (target?.isConnected) window.requestAnimationFrame(() => target.focus());
    setOpen(false);
    setIphoneOffer(false);
    setIphoneGuideOpen(false);
    setIphoneStep(0);
  }

  function start() {
    if (!returnFocusRef.current && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) returnFocusRef.current = document.activeElement;
    setStepIndex(0);
    setIphoneOffer(false);
    setIphoneGuideOpen(false);
    setIphoneStep(0);
    setOpen(true);
  }

  useEffect(() => {
    let autoStartTimer: number | undefined;
    if (!initiallySeen && !window.localStorage.getItem(storageKey)) {
      autoStartTimer = window.setTimeout(() => {
        window.localStorage.setItem(storageKey, "true");
        void fetch("/api/tutorial/seen", { method: "POST" });
        start();
      }, 350);
    }
    const handleOpen = () => start();
    const handleTutorialClick = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest("[data-open-tutorial]")) start();
    };
    window.addEventListener("pace-lab:open-tutorial", handleOpen);
    document.addEventListener("click", handleTutorialClick);
    return () => {
      if (autoStartTimer) window.clearTimeout(autoStartTimer);
      window.removeEventListener("pace-lab:open-tutorial", handleOpen);
      document.removeEventListener("click", handleTutorialClick);
    };
  }, [initiallySeen, storageKey]);

  useEffect(() => {
    if (!open || iphoneOffer || iphoneGuideOpen) {
      setFocus(null);
      return;
    }
    const updateFocus = () => setFocus(findFocus(steps[stepIndex]?.anchors));
    updateFocus();
    window.addEventListener("resize", updateFocus);
    window.addEventListener("scroll", updateFocus, true);
    return () => {
      window.removeEventListener("resize", updateFocus);
      window.removeEventListener("scroll", updateFocus, true);
    };
  }, [open, iphoneOffer, iphoneGuideOpen, stepIndex, steps]);

  // Acessibilidade: o foco entra no cartão a cada passo.
  useEffect(() => {
    if (!open) return;
    const primary = cardRef.current?.querySelector<HTMLButtonElement>("[data-tour-primary]");
    primary?.focus();
  }, [open, stepIndex, iphoneOffer, iphoneGuideOpen, iphoneStep]);

  useEffect(() => {
    document.body.classList.toggle("tutorial-open", open);
    return () => document.body.classList.remove("tutorial-open");
  }, [open]);

  if (!open) return null;
  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;
  const iphoneGuide = [
    { title: "Abra no Safari", text: "Com o Pace Lab aberto no Safari do iPhone, toque no botão Compartilhar, na barra inferior." },
    { title: "Escolha “Adicionar à Tela de Início”", text: "Deslize as opções até encontrar este item e toque nele." },
    { title: "Confirme em “Adicionar”", text: "O ícone do Pace Lab ficará na sua tela de início para abrir como aplicativo." },
  ][iphoneStep];

  function next() {
    if (!isLastStep) {
      setStepIndex((current) => current + 1);
      return;
    }
    if (role === "STUDENT") setIphoneOffer(true);
    else close();
  }

  // Teclado: Esc fecha; Tab circula dentro do cartão.
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key !== "Tab") return;
    const items = [...(cardRef.current?.querySelectorAll<HTMLElement>("button, a[href]") ?? [])];
    if (!items.length) return;
    const first = items[0]; const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  const progress = ((stepIndex + 1) / steps.length) * 100;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title" onKeyDown={onKeyDown}>
      {focus ? <div className="tour-spotlight" style={{ top: focus.top, left: focus.left, width: focus.width, height: focus.height }} /> : <div className="tour-backdrop" />}
      {iphoneOffer ? <section className="tour-card tour-card-centered" ref={cardRef}>
        <p className="tour-kicker">Pace Lab no iPhone</p>
        <h2 id="tour-title">Leve o Pace Lab para a tela de início.</h2>
        <p>Se você usa iPhone, veja o passo a passo rápido para abrir a plataforma como um app.</p>
        <div className="tour-actions"><button className="tour-button tour-button-quiet" type="button" onClick={close}>Agora não</button><button className="tour-button" type="button" data-tour-primary onClick={() => { setIphoneOffer(false); setIphoneGuideOpen(true); }}>Ver como instalar</button></div>
      </section> : null}
      {iphoneGuideOpen ? <section className="tour-card tour-card-centered" ref={cardRef}>
        <p className="tour-kicker">Como baixar o app Pace Lab <span>{iphoneStep + 1} / 3</span></p>
        <span className="tour-phone-icon" aria-hidden="true"><Icon name={iphoneStep === 1 ? "share" : "addSquare"} /></span>
        <h2 id="tour-title">{iphoneGuide.title}</h2>
        <p>{iphoneGuide.text}</p>
        <div className="tour-actions"><button className="tour-button tour-button-quiet" type="button" onClick={() => setIphoneStep((current) => Math.max(0, current - 1))}>Voltar</button><button className="tour-button" type="button" data-tour-primary onClick={() => iphoneStep === 2 ? close() : setIphoneStep((current) => current + 1)}>{iphoneStep === 2 ? "Concluir" : "Avançar"}</button></div>
      </section> : !iphoneOffer ? <section className="tour-card" ref={cardRef} aria-live="polite">
        <p className="tour-kicker">{step.label} <span>{String(stepIndex + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</span></p>
        <h2 id="tour-title">{stepIndex === 0 ? step.title.replace("você", name.split(" ")[0]) : step.title}</h2>
        <p>{step.text}</p>
        <div className="tour-progress" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>
        <div className="tour-actions"><button className="tour-button tour-button-quiet" type="button" onClick={close}>Pular</button>{stepIndex > 0 ? <button className="tour-button tour-button-quiet" type="button" onClick={() => setStepIndex((current) => current - 1)}>Voltar</button> : null}<button className="tour-button" type="button" data-tour-primary onClick={next}>{isLastStep ? "Finalizar" : "Avançar"}</button></div>
        {role === "STUDENT" ? <button className="tour-install" type="button" onClick={() => setIphoneGuideOpen(true)}>Como baixar app Pace Lab no iPhone</button> : null}
      </section> : null}
    </div>
  );
}
