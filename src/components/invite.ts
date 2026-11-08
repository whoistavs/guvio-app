import { Platform, Share } from "react-native";
import { inviteLink } from "../utils/profileLink";
import { toast } from "./motion";

/** manda o convite pessoal (link do site com ?convite=seu_usuario) */
export async function shareInvite(username?: string) {
  if (!username) return;
  const link = inviteLink(username);
  const message = `Tô testando o GUVIO, uma rede social de moda. Entra comigo no beta: ${link}`;
  try {
    if (Platform.OS === "web") {
      const nav: any = typeof navigator !== "undefined" ? navigator : null;
      if (nav?.share) await nav.share({ text: message, url: link }).catch(() => {});
      else {
        await nav?.clipboard?.writeText(message);
        toast("Convite copiado");
      }
      return;
    }
    await Share.share({ message });
  } catch {}
}
