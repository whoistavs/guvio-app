// Textos de Política de Privacidade e Termos de Uso mostrados em Configurações.
// Linguagem simples, alinhado à LGPD (Brasil) e ao RGPD (União Europeia).
// Revise com um advogado antes de publicar na App Store / Play Store.

export const CONTACT_EMAIL = "guvioapp@gmail.com";

const contato = CONTACT_EMAIL
  ? `Fale com a gente pelo e-mail ${CONTACT_EMAIL}.`
  : "Fale com a gente pelos canais de contato informados na página do Guvio.";

export type LegalDoc = { title: string; updated: string; sections: { h: string; p: string[] }[] };

export const LEGAL_TEXTS: Record<string, LegalDoc> = {
  privacy: {
    title: "Política de Privacidade",
    updated: "13 de novembro de 2026",
    sections: [
      {
        h: "1. Quem somos",
        p: [
          "O Guvio é uma rede social de moda onde você publica looks, organiza seu guarda-roupa digital e descobre o estilo de pessoas do mundo todo. Esta política explica quais dados coletamos, por que e quais são os seus direitos, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018 – LGPD) e, para quem está na União Europeia, com o Regulamento Geral sobre a Proteção de Dados (RGPD).",
          "O Guvio está em versão de testes (beta). Isso quer dizer que recursos podem mudar e que podem acontecer instabilidades.",
          `Responsáveis pelos seus dados (controladores): Octavio Rodrigues Schwab e Gustavo Reis, fundadores do Guvio. Contato para qualquer assunto de privacidade: ${CONTACT_EMAIL}.`
        ]
      },
      {
        h: "2. Dados que coletamos",
        p: [
          "Dados de conta: e-mail, nome de usuário, nome de exibição e, se você entrar com o Google, o identificador da sua conta Google. Não usamos a sua foto do Google automaticamente.",
          "Conteúdo que você cria: fotos, vídeos, legendas, hashtags, comentários, curtidas, votos em enquetes, avaliações de looks, stories e respostas a stories, mensagens do Direct, peças do guarda-roupa, lista de desejos, calendário de looks e looks montados.",
          "Acesso à galeria e à câmera: só quando você escolhe publicar algo, e apenas as fotos e vídeos que você seleciona são enviados.",
          "Localização: somente se você permitir, usamos a sua localização aproximada para marcar a cidade de um look e mostrar o clima. Você pode negar ou revogar essa permissão nos ajustes do celular.",
          "Avisos no celular: se você ligar os avisos, guardamos o identificador do seu aparelho ou navegador para avisos (um código gerado pelo sistema, sem dados pessoais) e quais tipos de aviso você quer receber. Ao desligar os avisos ou sair da conta, esse identificador é apagado.",
          "Votos no Look da semana: guardamos em qual look você votou para garantir um voto por pessoa por semana. Os outros usuários veem apenas o total de votos.",
          "Dados técnicos básicos: informações necessárias para manter sua sessão ativa e para corrigir erros do app. Não usamos ferramentas de rastreamento de anúncios.",
          "Ficam só no seu aparelho (não vão para os nossos servidores): o tempo de uso mostrado em Sua atividade, suas preferências do app e, se você usar Trocar de conta, o acesso salvo das contas que entraram neste aparelho. Ao sair de uma conta, o acesso salvo dela é apagado do aparelho.",
          "Feedbacks que você envia pelo app (texto e, se quiser, um print) são usados só para melhorar o Guvio."
        ]
      },
      {
        h: "3. Para que usamos",
        p: [
          "Para criar e manter sua conta, mostrar seus posts e o feed, permitir seguir pessoas, enviar mensagens e notificações (dentro do app e, se você permitir, avisos no celular), enviar e-mails de acesso à conta (como o código de recuperação de senha), proteger a comunidade (denúncias e bloqueios) e melhorar o funcionamento do Guvio.",
          "Não vendemos seus dados pessoais e não os usamos para publicidade de terceiros."
        ]
      },
      {
        h: "4. O que fica público",
        p: [
          "Seu nome de usuário, nome de exibição, foto de perfil, bio, posts, stories e a cidade marcada nos looks podem ser vistos por outras pessoas do Guvio. Se o seu perfil for privado, posts e stories aparecem só para quem você aprovou. Stories para Melhores amigos aparecem só para essa lista.",
          "Mensagens do Direct são visíveis apenas para quem participa da conversa. Seu guarda-roupa, lista de desejos, calendário e looks salvos são privados.",
          "Votos em enquetes de posts, avaliações e votos do Look da semana aparecem apenas como totais. Em enquetes e perguntas de stories, quem publicou o story pode ver quem votou ou respondeu."
        ]
      },
      {
        h: "5. Onde os dados ficam e com quem compartilhamos",
        p: [
          "Os dados são armazenados com o provedor de infraestrutura Supabase, com servidores nos Estados Unidos, com medidas de segurança como criptografia em trânsito e regras de acesso por usuário. O site do Guvio é hospedado no GitHub Pages.",
          "Para o app funcionar, alguns serviços recebem apenas o necessário: o Google (entrar com Google, envio dos e-mails do Guvio pelo Gmail e entrega dos avisos no Android pelo Firebase Cloud Messaging); a Apple (entrar com Apple e entrega dos avisos no iPhone); o Open-Meteo (recebe a localização aproximada para mostrar o clima); e, no site, o BigDataCloud e o OpenStreetMap (recebem a localização aproximada para descobrir o nome da cidade).",
          "Alguns desses serviços ficam fora do Brasil e da União Europeia. Nesses casos, a transferência acontece para cumprir o que você pediu ao usar o app e com as garantias previstas na LGPD e no RGPD. Nenhum deles recebe seus dados para fazer publicidade."
        ]
      },
      {
        h: "6. Seus direitos",
        p: [
          "Você pode acessar e corrigir seus dados editando o perfil, apagar posts, comentários e stories a qualquer momento, e apagar a sua conta em Configurações › Apagar minha conta. Ao apagar a conta, seu perfil e todo o conteúdo associado são removidos de forma definitiva.",
          `Para outros pedidos previstos na LGPD e no RGPD (confirmação, portabilidade, informações sobre compartilhamento), ${contato.charAt(0).toLowerCase()}${contato.slice(1)}`
        ]
      },
      {
        h: "7. Crianças",
        p: ["O Guvio não é destinado a menores de 13 anos. Se você souber de uma conta de criança, avise pelo e-mail de contato para removermos."]
      },
      {
        h: "8. Mudanças",
        p: [
          "Podemos atualizar esta política. Quando houver mudanças importantes, avisaremos dentro do app. A data no topo indica a versão atual.",
          contato
        ]
      }
    ]
  },
  terms: {
    title: "Termos de Uso",
    updated: "13 de novembro de 2026",
    sections: [
      {
        h: "1. Aceite",
        p: [
          "Ao criar uma conta ou usar o Guvio, você concorda com estes Termos e com a Política de Privacidade. Se não concordar, não use o app.",
          "O Guvio está em versão de testes (beta). Recursos podem mudar ou sair do ar, e a gente conta com seu feedback para melhorar."
        ]
      },
      {
        h: "2. Sua conta",
        p: [
          "Você é responsável pelas informações da sua conta e por manter seu acesso em segurança. Não crie contas se passando por outra pessoa ou marca.",
          "Se você usar Trocar de conta, qualquer pessoa com acesso ao seu aparelho desbloqueado consegue entrar nas contas salvas nele. Saia da conta em aparelhos que não são seus."
        ]
      },
      {
        h: "3. Seu conteúdo",
        p: [
          "As fotos e textos que você publica continuam sendo seus. Ao publicar, você permite que o Guvio armazene e exiba esse conteúdo dentro do app, apenas para o funcionamento do serviço. Essa permissão termina quando você apaga o conteúdo ou a conta.",
          "Publique apenas o que você tem direito de compartilhar e evite expor outras pessoas sem consentimento."
        ]
      },
      {
        h: "4. O que não é permitido",
        p: [
          "Conteúdo de nudez ou sexual, discurso de ódio, assédio, ameaças, violência, golpes, spam, venda de itens ilegais, violação de direitos autorais ou de marca e qualquer conteúdo envolvendo menores de forma inadequada.",
          "Tentar burlar a segurança do app, coletar dados de outras pessoas ou usar robôs para interagir."
        ]
      },
      {
        h: "5. Denúncias e moderação",
        p: [
          "Você pode denunciar posts, silenciar e bloquear perfis. As denúncias são analisadas pela equipe do Guvio. Podemos remover conteúdo ou suspender contas que violem estes Termos, com ou sem aviso prévio, para proteger a comunidade."
        ]
      },
      {
        h: "6. Disponibilidade",
        p: [
          "O Guvio é oferecido como está. Trabalhamos para mantê-lo estável, mas podem ocorrer falhas, mudanças ou interrupções. Recursos como sugestões de look e clima são indicações, não garantias."
        ]
      },
      {
        h: "7. Encerramento",
        p: [
          "Você pode parar de usar o Guvio e apagar sua conta quando quiser, em Configurações › Apagar minha conta."
        ]
      },
      {
        h: "8. Lei aplicável",
        p: [
          "O Guvio é mantido pelos seus fundadores, Octavio Rodrigues Schwab e Gustavo Reis.",
          "Estes Termos seguem as leis do Brasil. Se você mora em Portugal ou em outro país da União Europeia, também valem os direitos que as leis do seu país garantem.",
          contato
        ]
      }
    ]
  }
};
