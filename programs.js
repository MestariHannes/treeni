/* Valmiit treeniohjelmat. Ohjelma valitaan profiilista: välineet × treenipäivät viikossa.
   Sarjat ja toistot tulevat tavoitteesta (GOALS). Liikkeiden id:t ovat free-exercise-db:stä. */
window.Programs = (function () {
  const GOALS = {
    muscle:     { name: 'Lihasmassa', sets: 3, reps: '8–12', rest: 90 },
    strength:   { name: 'Voima',      sets: 4, reps: '4–6',  rest: 180 },
    fitness:    { name: 'Kunto',      sets: 3, reps: '12–15', rest: 60 },
    weightloss: { name: 'Laihdutus',  sets: 3, reps: '12–15', rest: 45 }
  };
  const LEVELS = { beginner: 'Aloittelija', intermediate: 'Keskitaso', expert: 'Edistynyt' };
  const EQUIP = { gym: 'Kuntosali', dumbbells: 'Kotona käsipainot', body: 'Vain oma paino' };

  // Liikkeet ryhmittäin, välineiden mukaan
  const X = {
    gym: {
      squat: 'Barbell_Squat', legs2: 'Leg_Press', hinge: 'Romanian_Deadlift', curl: 'Lying_Leg_Curls', calf: 'Standing_Calf_Raises', glute: 'Barbell_Hip_Thrust', lunge: 'Dumbbell_Lunges',
      push: 'Barbell_Bench_Press_-_Medium_Grip', push2: 'Incline_Dumbbell_Press', ohp: 'Standing_Military_Press', ohp2: 'Seated_Dumbbell_Press', lat: 'Side_Lateral_Raise',
      pull: 'Wide-Grip_Lat_Pulldown', row: 'Seated_Cable_Rows', row2: 'One-Arm_Dumbbell_Row', rear: 'Face_Pull',
      bi: 'Barbell_Curl', bi2: 'Hammer_Curls', tri: 'Triceps_Pushdown', tri2: 'EZ-Bar_Skullcrusher', core: 'Plank', core2: 'Hanging_Leg_Raise', dead: 'Barbell_Deadlift'
    },
    dumbbells: {
      squat: 'Goblet_Squat', legs2: 'Split_Squat_with_Dumbbells', hinge: 'Stiff-Legged_Dumbbell_Deadlift', curl: 'Single_Leg_Glute_Bridge', calf: 'Standing_Dumbbell_Calf_Raise', glute: 'Butt_Lift_Bridge', lunge: 'Dumbbell_Lunges',
      push: 'Dumbbell_Floor_Press', push2: 'Pushups', ohp: 'Dumbbell_Shoulder_Press', ohp2: 'Arnold_Dumbbell_Press', lat: 'Side_Lateral_Raise',
      pull: 'Bent_Over_Two-Dumbbell_Row', row: 'One-Arm_Dumbbell_Row', row2: 'Bent_Over_Two-Dumbbell_Row', rear: 'Dumbbell_Lying_Rear_Lateral_Raise',
      bi: 'Dumbbell_Bicep_Curl', bi2: 'Hammer_Curls', tri: 'Bench_Dips', tri2: 'Push-Ups_-_Close_Triceps_Position', core: 'Plank', core2: 'Russian_Twist', dead: 'Stiff-Legged_Dumbbell_Deadlift'
    },
    body: {
      squat: 'Bodyweight_Squat', legs2: 'Freehand_Jump_Squat', hinge: 'Single_Leg_Glute_Bridge', curl: 'Butt_Lift_Bridge', calf: 'Standing_Calf_Raises', glute: 'Butt_Lift_Bridge', lunge: 'Bodyweight_Walking_Lunge',
      push: 'Pushups', push2: 'Push-Ups_-_Close_Triceps_Position', ohp: 'Pushups', ohp2: 'Pushups', lat: 'Mountain_Climbers',
      pull: 'Inverted_Row', row: 'Inverted_Row', row2: 'Superman', rear: 'Superman',
      bi: 'Chin-Up', bi2: 'Inverted_Row', tri: 'Bench_Dips', tri2: 'Push-Ups_-_Close_Triceps_Position', core: 'Plank', core2: 'Air_Bike', dead: 'Single_Leg_Glute_Bridge'
    }
  };

  // Jaot: avaimet viittaavat X-ryhmiin
  const SPLITS = {
    full: { name: 'Koko keho', sessions: [
      { key: 'A', name: 'Koko keho A', slots: ['squat', 'push', 'row', 'ohp', 'curl', 'core'] },
      { key: 'B', name: 'Koko keho B', slots: ['hinge', 'pull', 'push2', 'lunge', 'lat', 'core2'] }
    ] },
    upperlower: { name: 'Ylä- ja alakroppa', sessions: [
      { key: 'U1', name: 'Yläkroppa 1', slots: ['push', 'row', 'ohp', 'pull', 'bi', 'tri'] },
      { key: 'L1', name: 'Alakroppa 1', slots: ['squat', 'hinge', 'lunge', 'calf', 'core'] },
      { key: 'U2', name: 'Yläkroppa 2', slots: ['ohp2', 'pull', 'push2', 'row2', 'lat', 'rear'] },
      { key: 'L2', name: 'Alakroppa 2', slots: ['dead', 'legs2', 'glute', 'curl', 'core2'] }
    ] },
    ppl: { name: 'Työntö, veto, jalat', sessions: [
      { key: 'PU', name: 'Työntävät', slots: ['push', 'ohp2', 'push2', 'lat', 'tri', 'tri2'] },
      { key: 'PL', name: 'Vetävät', slots: ['pull', 'row', 'row2', 'rear', 'bi', 'bi2'] },
      { key: 'LE', name: 'Jalat', slots: ['squat', 'hinge', 'legs2', 'curl', 'calf', 'core'] }
    ] }
  };

  // Aikaan perustuvat liikkeet: "toistot" = sekunnit
  const TIMED = { Plank: '30–60 s', Mountain_Climbers: '30–45 s' };

  // 1–3 päivää: koko keho, 4: ylä/ala, 5+: työntö–veto–jalat (yli 6 päivää kiertää samaa jakoa)
  function splitFor(days) { return days >= 5 ? 'ppl' : days === 4 ? 'upperlower' : 'full'; }

  // Palauttaa profiilin mukaisen ohjelman: { id, name, sessions:[{ id, name, items:[{id, sets, reps}] }] }
  function forProfile(p) {
    const eq = X[p.equipment] ? p.equipment : 'gym';
    const g = GOALS[p.goal] || GOALS.muscle;
    const sp = splitFor(+p.daysPerWeek || 3);
    const extra = p.level === 'expert' && p.goal !== 'weightloss' ? 1 : 0;
    const sessions = SPLITS[sp].sessions.map(s => {
      const seen = new Set();
      const items = s.slots.map(k => X[eq][k]).filter(id => !seen.has(id) && seen.add(id))
        .map((id, i) => ({ id, sets: g.sets + (i < 2 ? extra : 0) - (p.level === 'beginner' && i > 3 ? 1 : 0), reps: TIMED[id] || g.reps }));
      return { id: `${sp}-${eq}-${s.key}`, name: s.name, items };
    });
    return { id: `${sp}-${eq}`, name: SPLITS[sp].name, sessions, rest: g.rest };
  }

  // Seuraava ehdotettu sessio: ohjelman seuraava sen jälkeen, mikä tehtiin viimeksi
  function next(prog, history) {
    for (let i = history.length - 1; i >= 0; i--) {
      const k = prog.sessions.findIndex(s => s.id === history[i].templateId);
      if (k >= 0) return prog.sessions[(k + 1) % prog.sessions.length];
    }
    return prog.sessions[0];
  }

  return { GOALS, LEVELS, EQUIP, TIMED, forProfile, next };
})();
