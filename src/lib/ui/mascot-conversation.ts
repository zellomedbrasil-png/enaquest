export type MascotMoment = "inicio" | "questao" | "acerto" | "erro" | "revisao" | "fim" | "simulado";
type Choice = { label: string; reply: string; breathe?: boolean; close?: boolean };
type Conversation = { greetings: string[]; choices: [Choice, Choice] };

export const conversations: Record<MascotMoment, Conversation> = {
  inicio: {
    greetings: ["Bom te ver. Como você chega para o plantão de hoje?", "Vamos juntos hoje? Como está sua energia?", "Que bom encontrar você. Como está chegando para estudar?", "Mais um encontro por aqui. Como você está para começar?"],
    choices: [{ label: "Com energia", reply: "Vamos aproveitar esse ânimo. Comece pela primeira questão e dê espaço para pensar." }, { label: "Devagar hoje", reply: "Pode ser devagar. Vamos fazer uma questão por vez e descobrir como o dia anda." }],
  },
  questao: {
    greetings: ["Como está essa questão por aí?", "Estou por aqui. Como vai esse raciocínio?", "Uma questão de cada vez. Como está sendo esta?", "Quer um instante de companhia enquanto pensa?"],
    choices: [{ label: "Estou pensando", reply: "Pode pensar com calma. Comece pelo que o enunciado está pedindo e siga as pistas." }, { label: "Preciso respirar", reply: "Vamos respirar juntos por três ciclos. Inspire suavemente e solte o ar no seu ritmo.", breathe: true }],
  },
  acerto: {
    greetings: ["Boa! Quer guardar o que fez a diferença?", "Você chegou lá. Vamos lembrar a pista que ajudou?", "Boa resposta. Quer olhar para o caminho que você fez?", "Deu certo! Que tal guardar esse raciocínio?"],
    choices: [{ label: "Vou pensar nisso", reply: "Qual detalhe do enunciado te deu confiança? Vale levar essa pista para a próxima questão." }, { label: "Vamos seguir", reply: "Vamos juntos. Até a próxima!", close: true }],
  },
  erro: {
    greetings: ["Essa merece uma segunda olhada. Como você está?", "Estou aqui com você. Como foi receber essa correção?", "Vamos olhar com calma. Como ficou essa tentativa para você?", "Podemos aprender com essa. Como você está se sentindo?"],
    choices: [{ label: "Frustrou um pouco", reply: "Faz sentido ficar frustrado. Respira um pouco. Uma resposta não resume o que você sabe." }, { label: "Quero entender", reply: "Volte ao comentário e procure a pista que mudou a resposta. Qual trecho alterou seu raciocínio?" }],
  },
  revisao: {
    greetings: ["Vamos reencontrar essa questão. Como ela parece agora?", "De volta a essa ideia. Como está sendo olhar outra vez?", "Uma nova leitura. Essa questão está mais familiar?", "Vamos revisitar juntos. Como ela parece desta vez?"],
    choices: [{ label: "Mais familiar", reply: "Que bom reconhecer o caminho. Observe qual pista você percebe mais rápido desta vez." }, { label: "Ainda difícil", reply: "Podemos ir em etapas. Primeiro, o que a questão pede? Depois, quais dados ajudam a responder?" }],
  },
  fim: {
    greetings: ["Você chegou até aqui. Como foi esse plantão?", "Bloco concluído. Como foi esse tempo de estudo?", "Mais um encontro com o aprendizado. Como foi para você?", "Fechamos este bloco. Como você sai dele?"],
    choices: [{ label: "Rendeu bem", reply: "Bom trabalho! Escolha uma ideia que você quer levar deste bloco para amanhã." }, { label: "Foi puxado", reply: "Você dedicou tempo e atenção, mesmo sendo difícil. Agora pode dar espaço para descansar." }],
  },
  simulado: {
    greetings: ["Estou aqui. Uma questão de cada vez.", "Sigo com você. Vamos no seu ritmo.", "Um instante de companhia antes de continuar?", "Respira. Você pode seguir uma questão por vez."],
    choices: [{ label: "Respirar um instante", reply: "Vamos respirar juntos por três ciclos. O cronômetro da prova continua correndo.", breathe: true }, { label: "Seguir a prova", reply: "Estou por aqui. Boa continuação!", close: true }],
  },
};
