-- Textes d'effet des cartes bonus, affichés sur la carte.
update public.card_templates set description = case bonus_effect
  when 'revision_express' then 'Gèle l''usure du moteur pour la course (le compteur de runs ne s''incrémente pas).'
  when 'vidange_boite' then 'Gèle l''usure de la boîte pour la course (le compteur de runs ne s''incrémente pas).'
  when 'revision_complete' then 'Gèle simultanément l''usure du moteur et de la boîte de vitesses.'
  when 'huile_moteur_competition' then 'Multiplie par 0,5 le risque de casse calculé du moteur sur ce run (risque divisé par deux).'
  when 'huile_boite_competition' then 'Multiplie par 0,5 le risque de casse calculé de la boîte sur ce run (risque divisé par deux).'
  when 'assistance_plateau' then 'En cas d''échec au test de casse mécanique, le duel est perdu mais le composant cassé réintègre directement l''inventaire au lieu d''être envoyé au Musée de la casse.'
  else description
end
where category = 'bonus';
