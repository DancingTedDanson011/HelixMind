import { GlassPanel } from '@/components/ui/GlassPanel';

export default function ImprintPage() {
  return (
    <div className="min-h-screen pt-28 pb-20 px-4">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold mb-8 text-white">Impressum</h1>
        <GlassPanel className="p-8 lg:p-12">
          <div className="prose prose-invert prose-sm max-w-none
            prose-headings:text-white prose-headings:font-semibold
            prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
            prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
            prose-p:text-gray-300 prose-p:leading-relaxed
            prose-li:text-gray-300
            prose-strong:text-white
          ">
            <h2>Angaben gem&auml;&szlig; &sect; 5 TMG</h2>
            <p>
              HelixMind<br />
              [Stra&szlig;e und Hausnummer]<br />
              [PLZ und Ort]<br />
              Deutschland
            </p>

            <hr className="border-white/5 my-8" />

            <h2>Kontakt</h2>
            <p>
              <strong>E-Mail:</strong> legal@helixmind.dev<br />
              <strong>Web:</strong> https://helixmind.dev
            </p>

            <hr className="border-white/5 my-8" />

            <h2>Vertreten durch</h2>
            <p>
              [Name des Vertretungsberechtigten]
            </p>

            <hr className="border-white/5 my-8" />

            <h2>Verantwortlich f&uuml;r den Inhalt nach &sect; 55 Abs. 2 RStV</h2>
            <p>
              [Name]<br />
              [Stra&szlig;e und Hausnummer]<br />
              [PLZ und Ort]<br />
              Deutschland
            </p>

            <hr className="border-white/5 my-8" />

            <h2>EU-Streitschlichtung</h2>
            <p>
              Die Europ&auml;ische Kommission stellt eine Plattform zur Online-Streitbeilegung
              (OS) bereit:{' '}
              <a
                href="https://ec.europa.eu/consumers/odr/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                https://ec.europa.eu/consumers/odr/
              </a>
            </p>
            <p>
              Unsere E-Mail-Adresse finden Sie oben im Impressum. Wir sind nicht bereit oder
              verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
              teilzunehmen.
            </p>

            <hr className="border-white/5 my-8" />

            <h2>Haftung f&uuml;r Inhalte</h2>
            <p>
              Als Diensteanbieter sind wir gem&auml;&szlig; &sect; 7 Abs. 1 TMG f&uuml;r eigene Inhalte
              auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach &sect;&sect; 8
              bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, &uuml;bermittelte
              oder gespeicherte fremde Informationen zu &uuml;berwachen oder nach Umst&auml;nden
              zu forschen, die auf eine rechtswidrige T&auml;tigkeit hinweisen.
            </p>
            <p>
              Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach
              den allgemeinen Gesetzen bleiben hiervon unber&uuml;hrt. Eine diesbez&uuml;gliche
              Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten
              Rechtsverletzung m&ouml;glich. Bei Bekanntwerden von entsprechenden
              Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
            </p>

            <hr className="border-white/5 my-8" />

            <h2>Haftung f&uuml;r Links</h2>
            <p>
              Unser Angebot enth&auml;lt Links zu externen Websites Dritter, auf deren Inhalte
              wir keinen Einfluss haben. Deshalb k&ouml;nnen wir f&uuml;r diese fremden Inhalte
              auch keine Gew&auml;hr &uuml;bernehmen. F&uuml;r die Inhalte der verlinkten Seiten
              ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Die
              verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf m&ouml;gliche
              Rechtsverst&ouml;&szlig;e &uuml;berpr&uuml;ft. Rechtswidrige Inhalte waren zum
              Zeitpunkt der Verlinkung nicht erkennbar.
            </p>
            <p>
              Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne
              konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden
              von Rechtsverletzungen werden wir derartige Links umgehend entfernen.
            </p>

            <hr className="border-white/5 my-8" />

            <h2>Urheberrecht</h2>
            <p>
              Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten
              unterliegen dem deutschen Urheberrecht. Die Vervielf&auml;ltigung, Bearbeitung,
              Verbreitung und jede Art der Verwertung au&szlig;erhalb der Grenzen des
              Urheberrechtes bed&uuml;rfen der schriftlichen Zustimmung des jeweiligen Autors
              bzw. Erstellers. Downloads und Kopien dieser Seite sind nur f&uuml;r den privaten,
              nicht kommerziellen Gebrauch gestattet.
            </p>
            <p>
              Die HelixMind CLI-Software ist unter der AGPL-3.0-Lizenz ver&ouml;ffentlicht.
              Die Nutzungsbedingungen der CLI-Software richten sich nach den Bestimmungen
              dieser Lizenz.
            </p>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
