export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Grocery Compare</h1>
      <p>Compare your basket: Rohlík vs Košík.</p>

      <ul>
        <li>Create a basket</li>
        <li>Add products</li>
        <li>See which store is cheaper</li>
      </ul>

      <a href="/login">Login</a>
    </main>
  );
}
