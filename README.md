# github-metrics

### Instructions

##### 1. Install and build
```
yarn && yarn build
```
##### 2. [Load the unpacked chrome extension](https://developer.chrome.com/docs/extensions/mv3/getstarted/#unpacked) (select the `/dist` folder)
##### 3. Go to any page that starts with https://github.com/Addepar/ and you should see the 'Metrics' button appear in the top right
![image](https://user-images.githubusercontent.com/72764729/167273174-68dddd2f-bd8d-4a26-adfc-cdf91dee7218.png)

##### 4. Click the button to open the modal and fill out the config
- `User` - your github username
- `Token` - your [github token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) (needs the full set of `repo` and `user` scopes)
- `Remember` - whether or not to save your settings in your local storage (defaults to checked)
- `Start` - the start date you want to run metrics for (defaults to today minus 2 weeks)
- `End` - the end date you want to run metrics for (defaults to today)
- `Repos` - the names of the repos you want to include (defaults to AMP,Iverson)
- `Usernames` - the github usernames of the users you want to include

![image](https://user-images.githubusercontent.com/72764729/167273252-64e5d5a8-a665-400e-b0c7-73838b65c97e.png)

##### 5. Click 'Run' and wait a few seconds...
![image](https://user-images.githubusercontent.com/72764729/167272869-8e77b28c-96df-4a16-9a63-77424d152db9.png)
