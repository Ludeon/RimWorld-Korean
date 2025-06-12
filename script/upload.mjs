export const upload = async () => {
  const crowdinHost = Deno.env.get('CROWDIN_HOST')
  const crowdinToken = Deno.env.get('CROWDIN_TOKEN')
  if (!crowdinHost || !crowdinToken) {
    console.error('Error: CROWDIN_HOST and CROWDIN_TOKEN environment variables must be set.')
    Deno.exit(1)
  }

  let response = await fetch(`${crowdinHost}/api/v2/projects/2/directories`, {
    headers: { Authorization: `Bearer ${crowdinToken}` },
  })
  response = await response.json()

  console.log(response.data.map((d) => d.data))
}
