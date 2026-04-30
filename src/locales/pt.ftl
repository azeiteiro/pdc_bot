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

# Onboarding 2026 translations (Portuguese)

# Commands & Status Messages
onboarding-start-welcome = Bem-vindo! Para entrar no grupo do festival 2026, por favor complete o processo de registo usando /onboarding

onboarding-already-started = Já começou o registo. Por favor continue a responder às perguntas, ou use /cancel para recomeçar.

onboarding-already-waiting = Já submeteu o seu registo! Por favor aguarde a confirmação do pagamento.

onboarding-already-completed = Já está registado para 2026!

onboarding-cancelled = Registo cancelado. Pode começar novamente com /onboarding a qualquer momento.

onboarding-nothing-to-cancel = Nada para cancelar. Use /onboarding para verificar o seu estado.

# Conversation Steps
onboarding-name-confirm = Vejo que o seu nome é **{$name}** do seu perfil Telegram. Está correto?

onboarding-name-enter = Por favor insira o seu nome:

onboarding-arrival-date = Quando planeia chegar?

onboarding-departure-date = Quando planeia sair?

onboarding-date-help = (ex: 'amanhã', 'próxima sexta', '15/05/2026', ou clique 'Não sei')

onboarding-date-confirm = Entendido! **{$date}**. Correto?

onboarding-date-invalid = Não consegui entender essa data. Por favor tente novamente ou clique 'Não sei'

onboarding-car-question = Vai viajar de carro?

onboarding-departure-location = De onde vai partir?

onboarding-additional-info = Alguma informação adicional que gostaria de partilhar? (Opcional)

onboarding-summary = Por favor reveja a sua informação:

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
    Está correto?

onboarding-payment-instructions = Obrigado! A sua informação foi submetida.

    Para entrar no grupo 2026, precisamos de uma transferência de €50 para o Daniel.
    Isto pode ser feito via MBWay ou Revolut.

    MBWay: {$mbwayNumber}

    Assim que o seu pagamento for confirmado, receberá um link de convite para entrar no grupo 2026.

onboarding-invite-sent = Pagamento confirmado! Aqui está o seu link de convite para entrar no grupo 2026: {$inviteLink}

    Este link é de uso único e expirará depois de entrar.

onboarding-error-save-failed = Falha ao guardar os seus dados. Por favor tente /onboarding novamente ou contacte um administrador.

# Button Labels
onboarding-btn-confirm = ✓ Sim, está correto

onboarding-btn-edit = ✏️ Não, deixe-me escrever

onboarding-btn-dont-know = 🤷 Não sei ainda

onboarding-btn-enter-date = 📅 Inserir data

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
