"use client";

import { useEffect, useState } from "react";

type Role = "ADMIN" | "STUDENT";
type FocusRect = { top: number; left: number; width: number; height: number };
type TutorialStep = { label: string; title: string; text: string; anchors?: string[] };

const adminSteps: TutorialStep[] = [
  { label: "Bem-vindo", title: "É bom ter você no time.", text: "A Pace Lab organiza a rotina financeira para você manter o foco no que acontece fora da tela." },
  { label: "Cobranças", title: "Cobranças sem perder as exceções.", text: "Defina o valor padrão, agrupe alunos por mensalidade e escolha quem entra em cada reajuste.", anchors: ["[data-tutorial-anchor='nav-billing']"] },
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

function findFocus(anchors?: string[]) {
  if (!anchors) return null;
  for (const anchor of anchors) {
    const element = document.querySelector(anchor);
    if (!element) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { top: Math.max(8, rect.top - 8), left: Math.max(8, rect.left - 8), width: rect.width + 16, height: rect.height + 16 };
    }
  }
  return null;
}

export function PlatformTutorial({ role, name, userId }: { role: Role; name: string; userId: string }) {
  const steps = role === "ADMIN" ? adminSteps : studentSteps;
  const storageKey = `pace-lab:tutorial-seen:v1:${role}:${userId}`;
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [iphone, setIphone] = useState(false);
  const [iphoneOffer, setIphoneOffer] = useState(false);
  const [iphoneGuideOpen, setIphoneGuideOpen] = useState(false);
  const [iphoneStep, setIphoneStep] = useState(0);
  const [focus, setFocus] = useState<FocusRect | null>(null);

  function close() {
    setOpen(false);
    setIphoneOffer(false);
    setIphoneGuideOpen(false);
    setIphoneStep(0);
  }

  function start() {
    setStepIndex(0);
    setIphoneOffer(false);
    setIphoneGuideOpen(false);
    setIphoneStep(0);
    setOpen(true);
  }

  useEffect(() => {
    setIphone(/iPhone/i.test(window.navigator.userAgent));
    let autoStartTimer: number | undefined;
    if (!window.localStorage.getItem(storageKey)) {
      autoStartTimer = window.setTimeout(() => {
        window.localStorage.setItem(storageKey, "true");
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
  }, [storageKey]);

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
    if (iphone) setIphoneOffer(true);
    else close();
  }

  return (
    <div className="tutorial-layer" role="dialog" aria-modal="true" aria-label="Tutorial Pace Lab">
      {focus ? <div className="tutorial-focus" style={{ top: focus.top, left: focus.left, width: focus.width, height: focus.height }} /> : <div className="tutorial-backdrop" />}
      {iphoneOffer ? <section className="tutorial-card tutorial-card-centered">
        <p className="tutorial-kicker">Pace Lab no iPhone</p>
        <h2>Leve o Pace Lab para a tela de início.</h2>
        <p>Quer ver o passo a passo rápido para abrir a plataforma como um app no seu iPhone?</p>
        <div className="tutorial-actions"><button className="tutorial-button tutorial-button-quiet" type="button" onClick={close}>Agora não</button><button className="tutorial-button" type="button" onClick={() => { setIphoneOffer(false); setIphoneGuideOpen(true); }}>Ver como instalar</button></div>
      </section> : null}
      {iphoneGuideOpen ? <section className="tutorial-card tutorial-card-centered">
        <p className="tutorial-kicker">Como baixar o app Pace Lab</p>
        <div className="tutorial-phone-icon" aria-hidden="true">{iphoneStep === 1 ? "□↑" : "＋"}</div>
        <h2>{iphoneGuide.title}</h2>
        <p>{iphoneGuide.text}</p>
        <div className="tutorial-actions"><button className="tutorial-button tutorial-button-quiet" type="button" onClick={() => setIphoneStep((current) => Math.max(0, current - 1))}>Voltar</button><button className="tutorial-button" type="button" onClick={() => iphoneStep === 2 ? close() : setIphoneStep((current) => current + 1)}>{iphoneStep === 2 ? "Concluir" : "Avançar"}</button></div>
      </section> : !iphoneOffer ? <section className="tutorial-card" aria-live="polite">
        <p className="tutorial-kicker">{step.label} <span>{String(stepIndex + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</span></p>
        <h2>{stepIndex === 0 ? step.title.replace("você", name.split(" ")[0]) : step.title}</h2>
        <p>{step.text}</p>
        <div className="tutorial-progress" aria-hidden="true"><i style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} /></div>
        <div className="tutorial-actions"><button className="tutorial-button tutorial-button-quiet" type="button" onClick={close}>Pular</button>{stepIndex > 0 ? <button className="tutorial-button tutorial-button-quiet" type="button" onClick={() => setStepIndex((current) => current - 1)}>Voltar</button> : null}<button className="tutorial-button" type="button" onClick={next}>{isLastStep ? (iphone ? "Finalizar" : "Concluir") : "Avançar"}</button></div>
        {iphone ? <button className="tutorial-install-link" type="button" onClick={() => setIphoneGuideOpen(true)}>Como baixar app Pace Lab</button> : null}
      </section> : null}
    </div>
  );
}
