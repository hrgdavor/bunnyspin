import { expect, test, describe } from "bun:test";
import { addWelcomeMessage, changeConfigValue, commentConfigValue } from "./util.js";

describe("changeConfigValue", () => {
  test("missing key", () => {
    let input = `# DBName=main
`.split('\n')
    let result = changeConfigValue(input, 'DBTable', 'settings')

    expect(result).toEqual(`# DBName=main

DBTable=settings`.split('\n'));
  });

  test("key in comment", () => {
    let input = `# DBTable=main
`.split('\n')
    let result = changeConfigValue(input, 'DBTable', 'settings')
    expect(result).toEqual(`# DBTable=main

DBTable=settings`.split('\n'));
  });

  test("has value", () => {
    let input = `# DBTable=main
DBTable=test`.split('\n')
    let result = changeConfigValue(input, 'DBTable', 'settings')

    expect(result).toEqual(`# DBTable=main
DBTable=settings`.split('\n'));
  });

  test("has value, comment", () => {
    let input = `# DBTable=main
DBTable=test`.split('\n')
    let result = commentConfigValue(input, 'DBTable')

    expect(result).toEqual(`# DBTable=main
#DBTable=test`.split('\n'));
  });

});


test("addWelcome", () => {
  let input = `  echo "    - use: \\"sdk list java\\" to see available version"
  echo "    - use: \\"sdk install java java25\\" to instal specific version"
  echo "\nto change this welcome message, edit /root/.config/fish/functions/fish_greeting.fish"`.split('\n')

  let result = addWelcomeMessage(input, `  echo "  - mysql - mysql database server"
  echo "    - change default password"`)

  expect(result).toEqual(`  echo "    - use: \\"sdk list java\\" to see available version"
  echo "    - use: \\"sdk install java java25\\" to instal specific version"
  echo "  - mysql - mysql database server"
  echo "    - change default password"
  echo "\nto change this welcome message, edit /root/.config/fish/functions/fish_greeting.fish"`.split('\n'));
});
