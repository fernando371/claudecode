# 11 — Plano de emergência

## Os três botões de pânico

Todos ficam no painel, em **Configurações → Modo de emergência**, e têm
**efeito imediato**, sem reiniciar nada.

| Botão                                  | O que acontece                                                           |
| -------------------------------------- | ------------------------------------------------------------------------ |
| **Desligar a inteligência artificial** | Nenhuma resposta automática. Tudo vai para a fila de atendimento humano. |
| **Desligar o canal WhatsApp**          | O canal para de processar mensagens.                                     |
| **Modo somente humano**                | A IA não responde; todas as conversas vão para a fila.                   |

Também é possível fazer o mesmo pelo arquivo `.env`, mudando
`AI_ENABLED`, `WHATSAPP_ENABLED` ou `HUMAN_ONLY_MODE`.

---

## O que fazer em cada situação

### O agente respondeu algo errado sobre saúde

1. Ligue **Modo somente humano** imediatamente.
2. Abra **Eventos de auditoria** e localize a conversa.
3. Corrija a base de conhecimento ou a regra que falhou.
4. Reproduza o caso no simulador até ele passar.
5. Só então desligue o modo somente humano.

### Um cliente viu dados de outro cliente

1. Ligue **Modo somente humano**.
2. Registre o ocorrido (data, conversa, o que apareceu).
3. Avalie com o jurídico a necessidade de comunicação (LGPD, art. 48).
4. Não volte ao ar antes de reproduzir e corrigir o caso.

### Mensagem real foi enviada sem querer

1. Ponha `WHATSAPP_LIVE_ENABLED=false` e reinicie o serviço.
2. Confira em **Eventos de auditoria** quantas mensagens saíram.
3. Investigue quem e quando alterou a configuração.

### Shopify, SAP ou transportadora fora do ar

Nada a fazer: o sistema já detecta, avisa o cliente que não conseguiu consultar e
transfere para atendimento. **Nenhum dado é inventado.** Confira o volume na aba
**Indicadores → Erros de integração**.

### Volume de mensagens acima do esperado

1. O limite de requisições já protege o servidor.
2. Se a fila humana ficar grande, ligue **Modo somente humano** e reforce a equipe.
3. Reavalie os limites em `.env` (`RATE_LIMIT_MAX_PER_MINUTE`).

### O painel ficou inacessível

Se estiver em produção sem `ADMIN_PASSWORD` definido, o painel é bloqueado de
propósito. Defina a senha no cofre de segredos da hospedagem.

---

## Contatos a definir

- [ ] Responsável técnico do sistema (quem mexe no servidor)
- [ ] Responsável pelo atendimento (quem assume a fila)
- [ ] Responsável técnico da informação de saúde
- [ ] Contato jurídico para questões de LGPD
