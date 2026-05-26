type Props = {
  params: { featureId: string };
};

export default function FeaturePage({ params }: Props) {
  return (
    <main>
      <h1>{params.featureId}</h1>
      <button type="button">Run feature</button>
    </main>
  );
}
