// Textos de Política de Privacidade e Termos de Uso mostrados em Configurações.
// Modelo inicial em linguagem simples, alinhado à LGPD. Revise com um advogado
// antes de publicar na App Store / Play Store e preencha o e-mail de contato.

export const CONTACT_EMAIL = ""; // ex.: "contato@guvio.app"

const contato = CONTACT_EMAIL
  ? `Fale com a gente pelo e-mail ${CONTACT_EMAIL}.`
  : "Fale com a gente pelos canais de contato informados na página do Guvio.";

export type LegalDoc = { title: string; updated: string; sections: { h: string; p: string[] }[] };

export const LEGAL_TEXTS: Record<string, LegalDoc> = {
  privacy: {
    title: "Política de Privacidade",
    updated: "novembro de 2026",
    sections: [
      {
        h: "1. Quem somos",
        p: [
          "O Guvio é uma rede social de moda onde você publica looks, organiza seu guarda-roupa digital e descobre o estilo de pessoas do mundo todo. Esta política explica quais dados coletamos, por que e quais são os seus direitos, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018 – LGPD)."
        ]
      },
      {
        h: "2. Dados que coletamos",
        p: [
          "Dados de conta: e-mail, nome de usuário, nome de exibição e, se você entrar com o Google, o identificador da sua conta Google. Não usamos a sua foto do Google automaticamente.",
          "Conteúdo que você cria: fotos, legendas, hashtags, comentários, curtidas, stories, mensagens do Direct, peças do guarda-roupa e looks montados.",
          "Localização: somente se você permitir, usamos a sua localização aproximada para marcar a cidade de um look e mostrar o clima. Você pode negar ou revogar essa permissão nos ajustes do celular.",
          "Dados técnicos básicos: informações necessárias para manter sua sessão ativa e para corrigir erros do app."
        ]
      },
      {
        h: "3. Para que usamos",
        p: [
          "Para criar e manter sua conta, mostrar seus posts e o feed, permitir seguir pessoas, enviar mensagens e notificações dentro do app, proteger a comunidade (denúncias e bloqueios) e melhorar o funcionamento do Guvio.",
          "Não vendemos seus dados pessoais e não os usamos para publicidade de terceiros."
        ]
      },
      {
        h: "4. O que fica público",
        p: [
          "Seu nome de usuário, nome de exibição, foto de perfil, bio, posts, stories e a cidade marcada nos looks podem ser vistos por outras pessoas do Guvio. Mensagens do Direct são visíveis apenas para quem participa da conversa. Seu guarda-roupa e seus looks salvos são privados."
        ]
      },
      {
        h: "5. Onde os dados ficam",
        p: [
          "Os dados são armazenados com o provedor de infraestrutura Supabase, que pode processá-los fora do Brasil, com medidas de segurança como criptografia em trânsito e regras de acesso por usuário."
        ]
      },
      {
        h: "6. Seus direitos",
        p: [
          "Você pode acessar e corrigir seus dados editando o perfil, apagar posts, comentários e stories a qualquer momento, e apagar a sua conta em Configurações › Apagar minha conta. Ao apagar a conta, seu perfil e todo o conteúdo associado são removidos de forma definitiva.",
          `Para outros pedidos previstos na LGPD (confirmação, portabilidade, informações sobre compartilhamento), ${contato.charAt(0).toLowerCase()}${contato.slice(1)}`
        ]
      },
      {
        h: "7. Crianças",
        p: ["O Guvio não é destinado a menores de 13 anos."]
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
    updated: "novembro de 2026",
    sections: [
      {
        h: "1. Aceite",
        p: [
          "Ao criar uma conta ou usar o Guvio, você concorda com estes Termos e com a Política de Privacidade. Se não concordar, não use o app."
        ]
      },
      {
        h: "2. Sua conta",
        p: [
          "Você é responsável pelas informações da sua conta e por manter seu acesso em segurança. Não crie contas se passando por outra pessoa ou marca."
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
          "Você pode denunciar posts e bloquear perfis. Podemos remover conteúdo ou suspender contas que violem estes Termos, com ou sem aviso prévio, para proteger a comunidade."
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
        p: ["Estes Termos seguem as leis do Brasil.", contato]
      }
    ]
  }
};
