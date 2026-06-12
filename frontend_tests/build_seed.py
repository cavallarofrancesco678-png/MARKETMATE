"""Genera il JSON seed per localStorage 'marketmate_data' (test Round 67)."""
import json
from datetime import datetime, timedelta


def build_seed() -> str:
    now = datetime.now()
    dow = now.weekday()  # 0=Mon..6=Sun (python) — JS getDay(): 0=Sun
    # Ultima occorrenza dello stesso giorno-settimana nello stesso mese, anno prec.
    year_prev = now.year - 1
    # ultimo giorno del mese
    if now.month == 12:
        last_day = 31
    else:
        last_day = (datetime(year_prev, now.month + 1, 1) - timedelta(days=1)).day
    d = datetime(year_prev, now.month, last_day, 12, 0, 0)
    while d.weekday() != dow:
        d -= timedelta(days=1)
    date_prev = d

    today_iso_day = now.strftime('%Y-%m-%d')

    giorni = ['LUNEDÌ', 'MARTEDÌ', 'MERCOLEDÌ', 'GIOVEDÌ', 'VENERDÌ', 'SABATO', 'DOMENICA']
    today_label = giorni[dow]
    agenda = [
        {
            'giorno': g,
            'mercato': 'Magenta' if g == today_label else '',
            'km': 30 if g == today_label else 0,
            'p_giornaliero': 0,
            'p_annuo': 0,
            'is_plat_annuo': True,
            'lavorativo': g == today_label,
            'mediaScontrino': 0,
        }
        for g in giorni
    ]

    def iso(dt):
        return dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')

    seed = {
        'isConfigured': True,
        'lingua': 'Italiano',
        'isAlimentare': True,
        'nomeAttivita': 'Test',
        'nomeTitolare': 'Mario',
        'pin': '',
        'emailRecupero': '',
        'themeColor': '#D2691E',
        'targetMensile': 3000,
        'settore': 'Alimentare',
        'tipoCarburante': 'diesel',
        'phoneNumber': '',
        'otpEnabled': False,
        'speseFisseDisabilitate': [],
        'speseAnnueDisabilitate': [],
        'codiciInvito': [],
        'currentRole': 'AMMINISTRATORE',
        'joinedViaInviteCode': False,
        'partenzaDa': 'Magenta',
        'collaboratori': [],
        'fornitori': [{'nome': 'TestForn', 'prodotti': [], 'ricaricoMedio': 70}],
        'agenda': agenda,
        'speseAnnue': [],
        'fiere': [],
        'storicoGiornate': [
            {
                'data': iso(date_prev), 'mercato': 'Magenta', 'meteo': 'sole', 'km': 30,
                'lordo': 800, 'netto': 700, 'contanti': 500, 'pos': 300, 'spese_extra': 0,
                'dettaglio_staff': {}, 'dettaglio_invenduto': {}, 'dettaglio_fornitori': {},
                'migrated_periodic_v1': True,
            },
            {
                'data': now.strftime('%Y-%m-%dT10:00:00.000Z'), 'mercato': 'Magenta', 'meteo': 'sole', 'km': 30,
                'lordo': 600, 'netto': 500, 'contanti': 300, 'pos': 300, 'spese_extra': 0,
                'dettaglio_staff': {}, 'dettaglio_invenduto': {}, 'dettaglio_fornitori': {},
                'migrated_periodic_v1': True,
            },
        ],
        'storicoCarburante': [
            {'data': now.replace(day=5).strftime('%Y-%m-%dT12:00:00.000Z'), 'euro': 50},
            {'data': (now.replace(day=1) - timedelta(days=15)).strftime('%Y-%m-%dT12:00:00.000Z'), 'euro': 80},
        ],
        'spesePeriodiche': [
            {
                'id': 'sp_test_1',
                'nome': 'TestForn',
                'importo': 120,
                'categoria': 'fornitore',
                'from': today_iso_day,
                'to': today_iso_day,
                'type': 'CUSTOM',
                'dayOfPurchase': today_iso_day,
                'numeroFattura': 'FT-99',
                'pagamentoMode': 'fattura',
                'importoFattura': 120,
                'importoContanti': 0,
            }
        ],
        'appuntiAgenda': [],
        'ordiniAgenda': [],
        'storicoDiario': [],
        'speseExtraTags': [],
        'storicoScontrini': [],
        'speseExtraSession': None,
    }
    return json.dumps(seed, ensure_ascii=False)


if __name__ == '__main__':
    print(build_seed())
