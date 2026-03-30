-- Versandmethode auf WEBHOOK umstellen (n8n uebernimmt E-Mail-Versand)
UPDATE email_config SET versand_methode = 'WEBHOOK' WHERE versand_methode = 'SMTP';
