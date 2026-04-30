import { listProjects } from "@/lib/projects";
import { readStudioConfig } from "@/lib/studio";
import { mediaUrl } from "@/lib/media";
import ProjectCard from "@/app/components/ProjectCard";

export default async function Home() {
  const studio = await readStudioConfig();
  const projects = await listProjects();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="font-mono text-lg tracking-wide text-neutral-100">{studio.name}</h1>
        <p className="text-xs text-neutral-500 font-mono">
          {projects.length} project{projects.length === 1 ? "" : "s"}
        </p>
      </header>

      {projects.length === 0 ? (
        <div className="border border-neutral-800 rounded-lg p-8 text-center text-sm text-neutral-400">
          No projects yet. In your terminal, tell Claude:<br />
          <code className="text-neutral-300 mt-2 inline-block">
            Set up a new slopstudio project called &lt;slug&gt; about &lt;concept&gt;.
          </code>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <li key={p.slug}>
              <ProjectCard slug={p.slug} href={`/projects/${p.slug}/dna`}>
                <div className="aspect-video bg-neutral-900 flex items-center justify-center">
                  {p.thumbnailPath ? (
                    <img
                      src={mediaUrl(p.slug, p.thumbnailPath)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-neutral-600 font-mono">no thumbnail</span>
                  )}
                </div>
                <div className="p-4">
                  <p className="font-mono text-sm text-neutral-100">{p.title}</p>
                  <p className="text-xs text-neutral-500 font-mono mt-1">
                    {p.charCount} char · {p.locCount} loc · {p.sceneCount} scene
                  </p>
                </div>
              </ProjectCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
