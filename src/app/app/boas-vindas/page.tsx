import { redirect } from "next/navigation";

/** As boas-vindas viraram o onboarding em /comecar. O endereço antigo continua funcionando. */
export default function WelcomePage() {
  redirect("/comecar");
}
