import { test,expect,type Page } from '@playwright/test';
test.use({serviceWorkers:'block'});
async function account(page:Page) {
  await page.route('**/api/auth/session',route=>route.fulfill({json:{configured:true,user:{id:'11111111-1111-4111-8111-111111111111',email:'tester@example.test'},trial:null}}));
}
test('community data failures offer a working retry without displaying invented requests',async({page})=>{
  // Public browsing does not require an account or an auth-triggered refresh.
  await page.route('**/api/auth/session',route=>route.fulfill({json:{configured:true,user:null,trial:null}}));
  let unavailable=true;
  await page.route('**/api/platform?**',route=>{
    const view=new URL(route.request().url()).searchParams.get('view');
    if(view==='config')return route.fulfill({json:{available:true,aiAvailable:true}});
    if(view==='me')return route.fulfill({json:{supportedRequestIds:[]}});
    if(unavailable)return route.fulfill({status:503,json:{message:'Requests could not load. Please try again.'}});
    return route.fulfill({json:{available:true,requests:[],lessons:[]}});
  });
  await page.goto('/community');
  await expect(page.locator('main').getByRole('alert')).toContainText('Requests could not load');
  unavailable=false;await page.getByRole('button',{name:'Try again',exact:true}).click();
  await expect(page.locator('main').getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('0 requests',{exact:true})).toBeVisible();
  await expect(page.getByText('The next lesson can start with your question.')).toBeVisible();
});
for(const failure of ['service unavailable','malformed success'])test(`failed request submission keeps the draft and allows retry: ${failure}`,async({page})=>{
  await account(page);let failing=true;const requests:Record<string,unknown>[]=[];
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/platform**',async route=>{
    if(route.request().method()==='POST') {
      if(failing)return failure==='service unavailable'?route.fulfill({status:503,json:{message:'Could not save this request. Please retry.'}}):route.fulfill({status:200,body:'invalid json'});
      const body=route.request().postDataJSON();requests.push({...body,id:'22222222-2222-4222-8222-222222222222',supportCount:0,createdAt:'2026-10-17'});
      return route.fulfill({json:{ok:true}});
    }
    const view=new URL(route.request().url()).searchParams.get('view');
    return route.fulfill({json:view==='config'?{available:true,aiAvailable:true}:view==='me'?{supportedRequestIds:[]}:{available:true,requests,lessons:[]}});
  });
  await page.goto('/community');
  const title=page.getByLabel('Skill title',{exact:true}),description=page.getByLabel('What would help you?');
  await title.fill('Organize a toolbox');await description.fill('Help me keep basic hand tools in order.');
  const submit=page.getByRole('button',{name:'Post skill request'});await submit.click();
  await expect(page.locator('.platform-page > .platform-message')).toContainText(failure==='service unavailable'?'Could not save':'incomplete response');
  await expect(submit).toBeEnabled();await expect(title).toHaveValue('Organize a toolbox');
  await expect(description).toHaveValue('Help me keep basic hand tools in order.');expect(requests).toHaveLength(0);
  failing=false;await submit.click();
  await expect(page.getByRole('heading',{name:'Organize a toolbox',exact:true})).toBeVisible();
  await expect(title).toHaveValue('');expect(requests).toHaveLength(1);expect(errors).toEqual([]);
});
