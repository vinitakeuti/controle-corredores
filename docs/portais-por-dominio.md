# Portais Pace Lab por domínio

O mesmo serviço Pace Lab atende dois portais, sem duplicar banco de dados, integrações ou pagamentos:

| Portal | Domínio | Público |
| --- | --- | --- |
| Gestão | `https://gestao.pacelabcoaching.com` | Administradores e operadores |
| Alunos | `https://alunos.pacelabcoaching.com` | Alunos, planos e pagamentos |

## Ativação no Easypanel

1. No DNS da Vixpi, crie o apontamento de `alunos.pacelabcoaching.com` para o mesmo IP público da VPS.
2. No mesmo serviço já usado pela aplicação no Easypanel, adicione `alunos.pacelabcoaching.com` como domínio adicional. Não crie outro serviço, container ou porta.
3. Aguarde o certificado SSL ficar ativo para os dois domínios.
4. Nas variáveis de ambiente do serviço, configure:

```env
ADMIN_APP_URL=https://gestao.pacelabcoaching.com
STUDENT_APP_URL=https://alunos.pacelabcoaching.com
STUDENT_PORTAL_ENABLED=true
```

5. Salve e faça o redeploy do mesmo serviço.

## O que muda após ativar

- Admins e operadores entram apenas em `gestao.pacelabcoaching.com`.
- Alunos entram, escolhem planos e pagam apenas em `alunos.pacelabcoaching.com`.
- Links de pagamento, e-mails de pagamento e redefinições de senha de alunos passam a usar o domínio dos alunos.
- Convites de colaboradores continuam usando o domínio de gestão.
- Um link de pagamento antigo no domínio de gestão redireciona para o domínio dos alunos sem alterar o token.
- As rotas administrativas ficam indisponíveis no domínio dos alunos.
- O manifesto continua relativo ao domínio em que foi aberto; portanto, ao instalar `alunos.pacelabcoaching.com` no iPhone, o ícone Pace Lab continua aparecendo normalmente na tela inicial.

## Antes da ativação

Enquanto `STUDENT_PORTAL_ENABLED=false`, todos os fluxos permanecem no domínio atual de gestão. Isso permite publicar esta versão hoje sem interromper cadastro, Pix, cartão, e-mails ou links de pagamento.
