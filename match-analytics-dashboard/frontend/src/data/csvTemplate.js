// Modèle de fichier CSV unique : une ligne = un événement, tous types confondus.
// Les noms « Équipe A » et « Équipe B » sont des exemples à remplacer.
export const CSV_TEMPLATE = [
  'event_type,team,player,shirt_number,period,minute,second,video_time,x,y,end_x,end_y,outcome,pass_success,key_pass,xg,body_part',
  'shot,Équipe A,Joueur 9,9,1,23,15,1395,88.5,47.2,100,50,goal,,,0.42,right_foot',
  'pass,Équipe A,Joueur 8,8,1,24,2,,45.0,52.3,60.1,48.0,,yes,no,,',
  'corner,Équipe B,Joueur 7,7,1,31,40,,100,0,,,,,,,',
  'interception,Équipe A,Joueur 4,4,2,52,10,,35.2,60.0,,,,,,,',
  'duel,Équipe B,Joueur 10,10,2,67,55,,50.0,50.0,,,won,,,,',
  'tactical,Équipe A,,,2,70,0,,,,,,pressing_haut,,,,',
].join('\r\n') + '\r\n'
