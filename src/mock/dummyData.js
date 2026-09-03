const iso = (d) => d.toISOString();
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

function dummyData() {
  const user = {
    id: "user_demo",
    name: "Franz",
    email: "franzvincenttogonon@gmail.com",
    created_at: iso(daysAgo(120)),
  };

  return { user };
}

export const data = dummyData();
