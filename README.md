#  Bidè — Premium Care Services

Site web vitrine et e-services pour **Bidè**, plateforme de services premium (lavage auto, pressing, entretien, ménage) basée au **Togo**.

##  Aperçu

Bidè permet aux clients de :
- **Estimer** le coût d'un service en quelques clics (estimateur express)
- **Réserver** un créneau en centre ou à domicile
- **Suivre** l'avancement de leur commande
- **Payer** en espèces ou par Mobile Money (Wave, Orange, MTN)
- **Contacter** l'équipe directement via WhatsApp

##  Stack technique

| Technologie | Usage |
|---|---|
| **HTML5 / CSS3** | Structure et style |
| **Bootstrap 5.3.3** | Framework UI responsive |
| **Font Awesome 6.4.0** | Icônes |
| **Bootstrap Icons 1.11.3** | Icônes supplémentaires |
| **JavaScript vanilla** | Logique client (estimateur, panier, formulaires) |
| **OpenStreetMap / Nominatim** | Carte interactive & géolocalisation |
| **Cloudinary** | Hébergement des images et vidéos |

##  Structure du projet

```
├── index.html          # Page d'accueil (hero, estimateur, services)
├── lavage.html         # Service Lavage Auto (tarifs, détail, paiement)
├── pressing.html       # Service Pressing & Nettoyage Textile
├── entretien.html      # Service Entretien automobile
├── menage.html         # Service Ménage / Nettoyage résidentiel
├── commande.html       # Suivi de commande
├── partenaire.html     # Espace partenaires
├── admin.html          # Panel d'administration
├── css/
│   └── style.css       # Feuille de style principale (1900+ lignes)
├── js/
│   └── script.js       # Logique JavaScript (estimateur, panier, formulaires)
├── images/
│   └── logo.png        # Logo local
└── README.md
```

##  Mise en place

Ce projet est un site **statique** (sans backend). Pour le lancer localement :

```bash
# Option 1 : Python
python3 -m http.server 8080

# Option 2 : Node.js (si disponible)
npx serve .
```

Puis ouvrir [http://localhost:8080](http://localhost:8080) dans votre navigateur.

##  Design & UI

- **Design responsive** : s'adapte de desktop (>992px) à mobile (<576px)
- **Effets visuels** : glassmorphism, animations carrousel, transitions hover
- **Vidéos de fond** dans les sections hero
- **Palette** : bleu principal (`#0b5bd3`), fond gris-bleu (`#f4f6fb`)

##  Tarifs

### Lavage Auto (en centre, citadine)

| Pack | Prix |
|---|---|
| Express | 15 000 FCFA |
| Standard   | 25 000 FCFA |
| Premium | 45 000 FCFA |
| Rénovation | 80 000 FCFA |

> Les prix varient selon le type de véhicule (SUV +20%, Utilitaire +50%) et le lieu d'intervention (domicile +30%).

### Pressing

| Article | Prix |
|---|---|
| Chemise | 1 500 FCFA |
| Pantalon | 2 000 FCFA |
| Costume complet | 4 000 FCFA |

### Entretien
À partir de **15 000 FCFA**

### Ménage
À partir de **10 000 FCFA**

##  Contact

- **Téléphone** : [+228 97 90 67 11](tel:+22897906711)
- **Email** : [contact@bide.app](mailto:samuelazovic@gmail.com)
- **WhatsApp** : [Contacter via WhatsApp](https://wa.me/22897906711)

##  Horaires

| Jour | Horaire |
|---|---|
| Lundi — Samedi | 08h00 — 20h00 |
| Dimanche | Fermé |

##  Notes techniques

- Les données clients sont stockées localement via `localStorage` (migration vers **Supabase** prévue — voir les `TODO` dans le code JS)
- La géolocalisation utilise l'API Navigator Geolocation + reverse geocoding Nominatim
- Les images et vidéos sont hébergées sur **Cloudinary**
- Le modal de paiement intègre un formulaire RGPD avec conditions générales et politique de confidentialité

# Équipe

Projet réalisé dans le cadre de la formation en développement web à l'ADN par :

<table>
   <tr>
      <td align="center">
         <img src="https://res.cloudinary.com/wjsni1cc/image/upload/v1787337354/7d08ff58-56d7-4b42-9b91-0fb80b13b91c.png" width="120" alt="Photo de Winner">
         <br>
         <b>Komi Godwin SENOU</b>
         <br>
         <small>Scrum Master<small>
         <br>
         <small>godwinadkp97@icloud.com</small>
      </td>
      <td align="center">
         <img src="https://res.cloudinary.com/wjsni1cc/image/upload/v1787309155/Kakpovi_Nadia.jpg" width="120" alt="Photo de Nadia">
         <br>
         <b>KAKPOVI Dela Nadia</b>
         <br>
         <small>Design Lead<small>
         <br>
         <small>kakpovidela0509@gmail.com</small>
      </td>
      <td align="center">
         <img src="https://res.cloudinary.com/wjsni1cc/image/upload/v1787337330/f103aa55-9f11-4800-95a6-35aeb27ba0c3.png" width="120" alt="Photo de SamVic">
         <br>
         <b>Kossi Victoire AZONOUTSOU</b>
         <br>
         <small>JS lead<small>
         <br>
         <small>samuelazovic@gmail.com</small>
      </td>
      <td align="center">
         <img src="https://res.cloudinary.com/wjsni1cc/image/upload/v1787337550/549d3974-6937-4008-a881-d912d8537d79.png" width="120" alt="Photo de Isidore">
         <br>
         <b>Komlan Isidore DIDJIGNAN</b>
         <br>
         <small>Git Master<small>
         <br>
         <small>isdordjidjigna@gmail.com</small>
      </td>
   </tr>
</table>

##  Licence

© 2026 Bidè Premium Services. Tous droits réservés.
