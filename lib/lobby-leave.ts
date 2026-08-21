export function isExplicitLobbyLeave(request:Request){
  const url=new URL(request.url)
  if(url.searchParams.get('intent')==='explicit')return true
  const fetchMode=request.headers.get('sec-fetch-mode')?.toLowerCase()
  const contentType=request.headers.get('content-type')?.toLowerCase()??''
  return fetchMode!=='no-cors'&&!contentType.startsWith('application/json')
}
