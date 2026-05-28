# Traduções da conversa de despesas (Português Europeu)

# Instruções de uso
expense-usage = Utilização: /expense <título> <valor>
    Exemplo: /expense Almoço no festival 10.50
    Ou apenas /expense para modo interativo

# Prompts do fluxo interativo
expense-enter-description = Fornece uma descrição para a despesa, por exemplo, "Almoço no festival"

    Escreve /cancel a qualquer momento para sair.

expense-enter-amount = Fornece o valor da despesa, por exemplo, "10.50"

expense-enter-name = Não consegui saber o teu nome. Fornece-o manualmente, se faz favor.

expense-enter-date = Fornece a data (DD-MM-YYYY) ou escreve "hoje" para a data atual

# Erros de validação
expense-invalid-amount = Fornece um número válido para o valor da despesa.

expense-invalid-date = Fornece uma data válida no formato DD-MM-YYYY ou escreve "hoje"

# Mensagem de confirmação
expense-confirmation = Tenho os seguintes dados:
    Título: {$title}
    Valor: €{$amount}
    Nome: {$name}
    Data: {$date}

    Confirma a informação abaixo selecionando uma opção do teclado:

# Etiquetas dos botões do teclado
expense-edit-title = 📝 Editar título

expense-edit-name = 👤 Editar nome

expense-edit-value = 💲 Editar valor

expense-edit-date = 📅 Editar data

expense-cancel = ❌ Cancelar

expense-accept = ✅ Aceitar

# Prompts de edição
expense-edit-title-prompt = Fornece um novo título para a despesa:

expense-edit-value-prompt = Fornece um novo valor para a despesa, por exemplo, "10.50":

expense-edit-name-prompt = Fornece o nome de quem pagou:

# Mensagens de estado
expense-success = Despesa adicionada com sucesso!

expense-cancelled = Adição de despesa cancelada.

expense-sheets-error = Ocorreu um erro ao adicionar a despesa. Tenta novamente mais tarde.

expense-no-spreadsheet = O ID da folha de cálculo do Google não está configurado. Fala com o administrador.

# Valores de placeholder
expense-not-set = Não definido

# Language selection
language-selection-prompt = Escolha o seu idioma:

language-changed = Idioma alterado para Português ✅

language-error = Ocorreu um erro ao mudar o idioma. Tenta novamente.

language-error-answer = Erro ao mudar idioma

# Onboarding 2026 translations (Portuguese - European, informal)

# Commands & Status Messages
onboarding-start-welcome = Bem-vindo! Para entrares no grupo do festival 2026, completa o processo de registo usando /onboarding

onboarding-already-started = Já começaste o registo. Continua a responder às perguntas, ou usa /cancel para recomeçar.

onboarding-already-waiting = Já submeteste o teu registo! Aguarda a confirmação do pagamento.

onboarding-already-completed = Já estás registado para 2026!

onboarding-cancelled = Registo cancelado. Podes começar novamente com /onboarding a qualquer momento.

onboarding-nothing-to-cancel = Nada para cancelar. Usa /onboarding para verificar o teu estado.

# Conversation Steps
onboarding-name-confirm = Consigo ver que o teu nome é **{$name}** do teu perfil Telegram. Está correcto?

onboarding-name-enter = Por favor escreve o teu nome:

onboarding-arrival-date = Quando planeias chegar?

onboarding-departure-date = Quando planeias sair?

onboarding-date-help = (ex: 'amanhã', 'próxima sexta', '15/05/2026', ou clica 'Não sei')

onboarding-date-confirm = Entendido! **{$date}**. Correcto?

onboarding-date-invalid = Não consegui perceber essa data. Tenta novamente ou clica 'Não sei'

onboarding-car-question = Vais viajar de carro?

onboarding-departure-location = De onde vais partir?

onboarding-additional-info = Alguma informação adicional que gostarias de partilhar? (Opcional)

onboarding-summary = Por favor confirma a tua informação:

    Nome: {$name}
    Chegada: {$arrival}
    Partida: {$departure}
    Carro: {$car}
    {$departureLocation ->
      [empty] {""}
      *[other] Partida de: {$departureLocation}

    }
    {$additionalInfo ->
      [empty] {""}
      *[other] Info adicional: {$additionalInfo}

    }
    Está tudo correcto?

onboarding-payment-instructions = Obrigado! A tua informação foi submetida.

    Para entrares no grupo 2026, precisamos de uma transferência de €50 para o Daniel Azeiteiro, por MBWay ou Revolut.

    MBWay: {$mbwayNumber}

    Assim que o teu pagamento for confirmado, vais receber um link de convite para entrar no grupo 2026.

onboarding-btn-pay-revolut = 💸 Pagar via Revolut

onboarding-invite-sent = Pagamento confirmado! Aqui está o teu link de convite para entrar no grupo 2026: {$inviteLink}

    Este link é de uso único e expira depois de entrares.

onboarding-error-save-failed = Falha ao guardar os teus dados. Tenta /onboarding novamente ou contacta um administrador.

# Button Labels
onboarding-btn-confirm = ✓ Sim, está correcto

onboarding-btn-edit = ✏️ Não, deixa-me escrever

onboarding-btn-dont-know = 🤷 Ainda não sei

onboarding-btn-enter-date = 📅 Escrever data

onboarding-btn-yes-car = 🚗 Sim

onboarding-btn-no-car = ❌ Não

onboarding-btn-skip = ⏭️ Saltar

onboarding-btn-submit = ✅ Submeter

onboarding-btn-cancel = ❌ Cancelar

# Admin Messages
onboarding-admin-notification = 🔔 Nova Submissão de Registo

    Utilizador: @{$username} (ID: {$userId})
    Estado: Aguarda confirmação de pagamento

    Use /confirm {$userId} para aprovar e enviar link de convite.

onboarding-admin-confirm-success = ✅ Convite enviado para @{$username} (ID: {$userId})

onboarding-admin-pending-empty = Não há submissões de registo pendentes.

onboarding-admin-pending-started = Iniciados ({$count}):

onboarding-admin-pending-waiting = Aguardam Pagamento ({$count}):

onboarding-admin-error-not-found = ID de utilizador {$userId} não encontrado na base de dados.

onboarding-admin-error-wrong-status = Utilizador @{$username} não está à espera de pagamento (estado atual: {$status})

onboarding-admin-error-unauthorized = Não está autorizado a usar este comando.

onboarding-admin-error-invalid-id = ID de utilizador inválido. Por favor use: /confirm <user_id>

onboarding-admin-error-invite-failed = Falha ao criar link de convite. Por favor tente novamente ou verifique as permissões do bot.

onboarding-admin-error-config = Configuração GROUP_CHAT_ID inválida.

# Special Values (for Sheet Data)
onboarding-dont-know = Não sei

onboarding-yes = Sim

onboarding-no = Não

# Traduções de comandos gerais (Português)

general-lineup-select-day = Seleciona o dia

general-unknown-error = Erro desconhecido, tenta novamente mais tarde

general-expense-private-only = ℹ️ Por favor usa o comando /expense numa conversa privada comigo: https://t.me/{$username}

general-about = Este bot permite-te ver o alinhamento do festival PDC. Usa /help para ver mais.
